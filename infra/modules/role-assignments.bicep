@description('Principal ID of the agent service managed identity')
param agentServicePrincipalId string

@description('Cosmos DB account name')
param cosmosDbAccountName string

@description('AI Search service name')
param aiSearchName string

@description('Key Vault name')
param keyVaultName string

@description('Container Registry name')
param containerRegistryName string

@description('Deploying user principal ID')
param principalId string = ''

// ─── Built-in Role Definition IDs ───
var cosmosDbDataContributor = '00000000-0000-0000-0000-000000000002'
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var searchIndexDataReader = '1407120a-92aa-4202-b7e9-c0e197c71c8f'
var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// ─── References ───
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosDbAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource aiSearch 'Microsoft.Search/searchServices@2023-11-01' existing = {
  name: aiSearchName
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: replace(containerRegistryName, '-', '')
}

// ─── Agent Service → Cosmos DB ───
resource agentCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  parent: cosmosDb
  name: guid(cosmosDb.id, agentServicePrincipalId, cosmosDbDataContributor)
  properties: {
    roleDefinitionId: '${cosmosDb.id}/sqlRoleDefinitions/${cosmosDbDataContributor}'
    principalId: agentServicePrincipalId
    scope: cosmosDb.id
  }
}

// ─── Agent Service → Key Vault ───
resource agentKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, agentServicePrincipalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: agentServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ─── Agent Service → AI Search ───
resource agentSearchRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiSearch.id, agentServicePrincipalId, searchIndexDataReader)
  scope: aiSearch
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', searchIndexDataReader)
    principalId: agentServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ─── Agent Service → Container Registry ───
resource agentAcrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, agentServicePrincipalId, acrPull)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: agentServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ─── Deploying User → Cosmos DB (for local dev) ───
resource userCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = if (!empty(principalId)) {
  parent: cosmosDb
  name: guid(cosmosDb.id, principalId, cosmosDbDataContributor)
  properties: {
    roleDefinitionId: '${cosmosDb.id}/sqlRoleDefinitions/${cosmosDbDataContributor}'
    principalId: principalId
    scope: cosmosDb.id
  }
}

// ─── Deploying User → Key Vault ───
resource userKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(keyVault.id, principalId, keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: principalId
    principalType: 'User'
  }
}
