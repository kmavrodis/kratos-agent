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
param appInsightsConnectionString string

@description('Cosmos DB endpoint')
param cosmosDbEndpoint string

@description('AI Search endpoint')
param aiSearchEndpoint string

@description('Key Vault URI')
param keyVaultUri string

@description('Microsoft Foundry endpoint')
param foundryEndpoint string

@description('Foundry model deployment name')
param foundryModelDeployment string

resource agentService 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'agent-service' })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: '${replace(containerRegistryName, '-', '')}.azurecr.io'
          identity: 'system'
        }
      ]
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'OPTIONS']
          allowedHeaders: ['*']
          maxAge: 3600
        }
      }
    }
    template: {
      containers: [
        {
          name: 'agent-service'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'COSMOS_DB_ENDPOINT', value: cosmosDbEndpoint }
            { name: 'AI_SEARCH_ENDPOINT', value: aiSearchEndpoint }
            { name: 'KEY_VAULT_URI', value: keyVaultUri }
            { name: 'FOUNDRY_ENDPOINT', value: foundryEndpoint }
            { name: 'FOUNDRY_MODEL_DEPLOYMENT', value: foundryModelDeployment }
            { name: 'OTEL_SERVICE_NAME', value: 'kratos-agent-service' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
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

output id string = agentService.id
output name string = agentService.name
output url string = 'https://${agentService.properties.configuration.ingress.fqdn}'
output principalId string = agentService.identity.principalId
