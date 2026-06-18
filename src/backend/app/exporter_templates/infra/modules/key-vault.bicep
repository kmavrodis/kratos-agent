// Demo export copy of Kratos's key-vault module.
//
// Diverges from the repo-root infra/modules/key-vault.bicep: the standalone
// hosted-agent demo keeps the vault publicly reachable (RBAC authorization
// still governs every secret) instead of a `defaultAction: Deny` firewall +
// private endpoint behind a VNet. A Foundry hosted agent isn't injected into
// the export's network, and the operator running `azd up` needs data-plane
// reach too. For a production deployment, re-enable private networking (see
// the repo-root module).

@description('Name of the Key Vault')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

output id string = keyVault.id
output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
