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

@description('AI Services (Foundry) account endpoint, e.g. https://acct.cognitiveservices.azure.com/ (trailing slash expected)')
param aiServicesEndpoint string

@description('Log Analytics workspace resource ID — destination for the GenAI gateway LLM logs (ApiManagementGatewayLlmLog).')
param logAnalyticsWorkspaceId string

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

// ─── Route APIM platform logs (incl. the GenAI gateway LLM log) to Log Analytics ───
// 'Dedicated' destination => the dedicated ApiManagementGatewayLlmLog table.
resource apimDiagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: apim
  name: 'apim-to-law'
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logAnalyticsDestinationType: 'Dedicated'
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// ─── Azure Monitor logger — destination for the LLM message diagnostic ───
resource azureMonitorLogger 'Microsoft.ApiManagement/service/loggers@2024-06-01-preview' = {
  parent: apim
  name: 'azuremonitor'
  properties: {
    loggerType: 'azureMonitor'
    isBuffered: false
  }
}

// ─── Application Insights logger (general APIM telemetry / request-body fallback) ───
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

// ─── Backend → the SAME AI Services (Foundry) account, under /openai ───
// APIM authenticates to this backend with its own system-assigned managed
// identity (see the API policy below); no keys are used.
resource aoaiBackend 'Microsoft.ApiManagement/service/backends@2024-06-01-preview' = {
  parent: apim
  name: 'aoai-foundry'
  properties: {
    description: 'Azure AI Services (Foundry) OpenAI endpoint'
    protocol: 'http'
    url: '${aiServicesEndpoint}openai'
  }
}

// ─── Azure OpenAI passthrough API ───
// Public path is /openai/... so the Copilot SDK base_url
// `{gateway}/openai/deployments/{model}` routes here unchanged.
resource aoaiApi 'Microsoft.ApiManagement/service/apis@2024-06-01-preview' = {
  parent: apim
  name: 'aoai'
  properties: {
    displayName: 'Azure OpenAI (Foundry)'
    description: 'Chat completions passthrough to the AI Services account, MI-authenticated. Fronts the hosted agent LLM calls so prompts + completions are captured in the GenAI gateway log.'
    path: 'openai'
    protocols: [
      'https'
    ]
    subscriptionRequired: false
    serviceUrl: '${aiServicesEndpoint}openai'
  }
}

// Only chat/completions is exposed (tightly scoped — no catch-all root).
resource chatCompletionsOp 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  parent: aoaiApi
  name: 'chat-completions'
  properties: {
    displayName: 'Create chat completion'
    method: 'POST'
    urlTemplate: '/deployments/{deployment-id}/chat/completions'
    templateParameters: [
      {
        name: 'deployment-id'
        description: 'Model deployment name'
        type: 'string'
        required: true
      }
    ]
  }
}

// ─── API-level policy ───
// * MI auth: APIM's system-assigned identity mints a token for the AI Services
//   resource and forwards it (overwriting any inbound Authorization).
// * buffer-response="false": preserve SSE streaming end-to-end.
resource aoaiApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2024-06-01-preview' = {
  parent: aoaiApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '''<policies>
  <inbound>
    <base />
    <set-backend-service backend-id="aoai-foundry" />
    <authentication-managed-identity resource="https://cognitiveservices.azure.com" />
  </inbound>
  <backend>
    <forward-request timeout="240" buffer-response="false" />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>'''
  }
  dependsOn: [
    aoaiBackend
  ]
}

// ─── LLM message logging (prompts + completions) → Azure Monitor / Log Analytics ───
// This is the GenAI-gateway-aware diagnostic. It captures the chat-completions
// REQUEST (prompt + tools schema) and RESPONSE (completion). Streamed responses
// are split into sequence-numbered chunks reassembled by CorrelationId in the
// ApiManagementGatewayLlmLog table — exactly the "capture the pieces and stitch"
// behaviour. maxSizeInBytes 256KB; messages larger are chunked.
resource aoaiLlmDiagnostic 'Microsoft.ApiManagement/service/apis/diagnostics@2024-06-01-preview' = {
  parent: aoaiApi
  name: 'azuremonitor'
  properties: {
    alwaysLog: 'allErrors'
    verbosity: 'verbose'
    logClientIp: true
    loggerId: azureMonitorLogger.id
    sampling: {
      samplingType: 'fixed'
      percentage: json('100')
    }
    largeLanguageModel: {
      logs: 'enabled'
      requests: {
        messages: 'all'
        maxSizeInBytes: 262144
      }
      responses: {
        messages: 'all'
        maxSizeInBytes: 262144
      }
    }
  }
}

// ─── App Insights diagnostic (request-body fallback capture) ───
// Captures the inbound request body to App Insights too, as a belt-and-suspenders
// fallback for the LLM request payload. Response body NOT logged (would buffer SSE).
resource aoaiAppInsightsDiagnostic 'Microsoft.ApiManagement/service/apis/diagnostics@2024-06-01-preview' = {
  parent: aoaiApi
  name: 'applicationinsights'
  properties: {
    alwaysLog: 'allErrors'
    httpCorrelationProtocol: 'W3C'
    logClientIp: true
    loggerId: appInsightsLogger.id
    metrics: true
    verbosity: 'verbose'
    sampling: {
      samplingType: 'fixed'
      percentage: json('100')
    }
    frontend: {
      request: {
        body: {
          bytes: 8192
        }
      }
    }
    backend: {
      request: {
        body: {
          bytes: 8192
        }
      }
    }
  }
}

output id string = apim.id
output name string = apim.name
output gatewayUrl string = apim.properties.gatewayUrl
output principalId string = apim.identity.principalId
