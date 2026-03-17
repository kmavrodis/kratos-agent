@description('Name of the Microsoft Foundry resource')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Name of the Foundry project')
param projectName string = '${name}-proj'

@description('Name of the GPT model deployment')
param modelDeploymentName string = 'gpt-52'

@description('Model name to deploy')
param modelName string = 'gpt-5.2'

@description('Model version')
param modelVersion string = '2025-12-11'

@description('Deployment SKU capacity (thousands of tokens per minute)')
param modelCapacity int = 1000

resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: name
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: aiFoundry
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: aiFoundry
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

output id string = aiFoundry.id
output name string = aiFoundry.name
output endpoint string = aiFoundry.properties.endpoint
output modelDeploymentName string = modelDeployment.name
output projectName string = project.name
