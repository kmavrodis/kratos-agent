@description('Name of the Storage Account')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Name of the blob container for skills')
param skillsContainerName string = 'skills'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource skillsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: skillsContainerName
  properties: {
    publicAccess: 'None'
  }
}

output id string = storageAccount.id
output name string = storageAccount.name
output endpoint string = 'https://${storageAccount.name}.blob.${environment().suffixes.storage}'
