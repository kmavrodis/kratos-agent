@description('Name of the Azure AI Services account')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Name of the GPT model deployment')
param modelDeploymentName string = 'gpt-52'

@description('Model name to deploy')
param modelName string = 'gpt-5.2'

@description('Model version')
param modelVersion string = '2025-12-11'

@description('Deployment SKU capacity (thousands of tokens per minute)')
param modelCapacity int = 30

resource aiServices 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: aiServices
  name: modelDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: modelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
  }
}

output id string = aiServices.id
output name string = aiServices.name
output endpoint string = aiServices.properties.endpoint
output modelDeploymentName string = modelDeployment.name
