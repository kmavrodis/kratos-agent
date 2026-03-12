@description('Name of the AI Search service')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Subnet ID for private endpoint')
param subnetId string

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
    publicNetworkAccess: 'disabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: '${name}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${name}-plsc'
        properties: {
          privateLinkServiceId: aiSearch.id
          groupIds: ['searchService']
        }
      }
    ]
  }
}

output id string = aiSearch.id
output name string = aiSearch.name
output endpoint string = 'https://${aiSearch.name}.search.windows.net'
