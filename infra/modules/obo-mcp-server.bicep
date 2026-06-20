/*
  Container App that runs the OBO MCP server (src/obo-mcp-server).

  Identity model — ONE user-assigned managed identity (created in main.bicep via
  obo-identity.bicep) does everything:
    * pulls the image from ACR (AcrPull role assigned here),
    * is the runtime identity of the container (ManagedIdentityCredential), and
    * is the federated subject the OBO server app trusts (FIC in obo-entra-app.bicep),
      so the OBO token exchange needs no client secret.
*/

@description('Name of the Container App')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Container Apps Environment ID')
param containerAppsEnvId string

@description('Container Registry name')
param containerRegistryName string

@description('App Insights connection string')
param appInsightsConnectionString string = ''

@description('Resource id of the OBO user-assigned managed identity')
param oboIdentityId string

@description('Client id of the OBO user-assigned managed identity (selects the MI for the token-exchange assertion)')
param oboIdentityClientId string

@description('Principal (object) id of the OBO user-assigned managed identity (for the AcrPull role)')
param oboIdentityPrincipalId string

@description('Tenant id that issues + validates user tokens')
param tenantId string

@description('appId of the OBO server app registration (OBO client_id + expected audience)')
param oboApiClientId string

@description('Downstream Microsoft Graph delegated scope(s), space-separated')
param graphScopes string = 'https://graph.microsoft.com/User.Read'

@description('Space-separated client app ids allowed to call this server (azp/appid allow-list)')
param allowedClientAppIds string = ''

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrName = replace(containerRegistryName, '-', '')

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, oboIdentityId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: oboIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource oboMcpServer 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'obo-mcp-server' })
  dependsOn: [acrPullRole]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${oboIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: '${acrName}.azurecr.io'
          identity: oboIdentityId
        }
      ]
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'obo-mcp-server'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'AZURE_TENANT_ID', value: tenantId }
            { name: 'OBO_API_CLIENT_ID', value: oboApiClientId }
            // Runtime identity: selects the UAMI for the token-exchange assertion.
            { name: 'AZURE_CLIENT_ID', value: oboIdentityClientId }
            { name: 'GRAPH_SCOPES', value: graphScopes }
            { name: 'ALLOWED_CLIENT_APP_IDS', value: allowedClientAppIds }
            { name: 'ENVIRONMENT', value: 'production' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'PORT', value: '8000' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output id string = oboMcpServer.id
output name string = oboMcpServer.name
output url string = 'https://${oboMcpServer.properties.configuration.ingress.fqdn}'
output mcpUrl string = 'https://${oboMcpServer.properties.configuration.ingress.fqdn}/mcp'
