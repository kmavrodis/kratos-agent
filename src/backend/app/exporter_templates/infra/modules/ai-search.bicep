// Demo export copy of Kratos's ai-search module.
//
// Diverges from the repo-root infra/modules/ai-search.bicep: the standalone
// hosted-agent demo keeps AI Search publicly reachable (RBAC via the
// aadOrApiKey auth options still governs access) instead of
// `publicNetworkAccess: disabled` + a private endpoint behind a VNet. A
// Foundry hosted agent isn't injected into the export's network, so a private
// endpoint would leave the agent unable to reach Search after `azd up`. For a
// production deployment, re-enable private networking (see the repo-root
// module).

@description('Name of the AI Search service')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

resource aiSearch 'Microsoft.Search/searchServices@2023-11-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'basic'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

output id string = aiSearch.id
output name string = aiSearch.name
output endpoint string = 'https://${aiSearch.name}.search.windows.net'
