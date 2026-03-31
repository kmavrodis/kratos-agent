@description('Name of the API Management service')
param name string

@description('Location')
param location string

@description('Tags')
param tags object = {}

@description('Publisher email for APIM')
param publisherEmail string

@description('Publisher name for APIM')
param publisherName string = '${name} AI Gateway'

@description('Application Insights resource ID')
param appInsightsId string

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string

// ─── API Management Service (BasicV2 for AI Gateway) ───
resource apim 'Microsoft.ApiManagement/service@2024-06-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'BasicV2'
    capacity: 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false'
    }
  }
}

// ─── Application Insights Logger ───
resource appInsightsLogger 'Microsoft.ApiManagement/service/loggers@2024-06-01-preview' = {
  parent: apim
  name: 'appinsights'
  properties: {
    loggerType: 'applicationInsights'
    credentials: {
      instrumentationKey: appInsightsInstrumentationKey
    }
    resourceId: appInsightsId
  }
}

// ─── Application Insights Diagnostic (100% sampling for Foundry Traces) ───
resource appInsightsDiagnostic 'Microsoft.ApiManagement/service/diagnostics@2024-06-01-preview' = {
  parent: apim
  name: 'applicationinsights'
  properties: {
    loggerId: appInsightsLogger.id
    logClientIp: true
    sampling: {
      samplingType: 'fixed'
      percentage: 100
    }
  }
}

output id string = apim.id
output name string = apim.name
output gatewayUrl string = apim.properties.gatewayUrl
