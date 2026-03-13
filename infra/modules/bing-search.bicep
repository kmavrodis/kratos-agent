@description('Name of the Bing Grounding resource')
param name string

@description('Tags')
param tags object = {}

@description('Key Vault name to store the API key')
param keyVaultName string

resource bingGrounding 'Microsoft.Bing/accounts@2020-06-10' = {
  name: name
  location: 'global'
  tags: tags
  kind: 'Bing.Grounding'
  sku: {
    name: 'G1'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource bingApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'bing-search-api-key'
  properties: {
    value: bingGrounding.listKeys().key1
  }
}

output id string = bingGrounding.id
output name string = bingGrounding.name
output endpoint string = bingGrounding.properties.endpoint
