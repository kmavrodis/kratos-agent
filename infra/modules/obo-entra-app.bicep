/*
  Entra (Microsoft Entra ID) application registrations for the OBO MCP server.

  This single module is deployed twice (mirrors the azmcp-obo-template pattern):

    1. isServer = false  -> the SPA CLIENT app.
       The browser frontend (MSAL.js) signs the user in against this app and
       acquires an access token for the server app's `access_as_user` scope.
       Registered as a Single-Page Application (`spa.redirectUris`).

    2. isServer = true   -> the OBO SERVER app (the MCP server's identity).
       Exposes the `access_as_user` delegated scope, pre-authorizes the SPA
       client (so users are not prompted to consent), holds the delegated
       Microsoft Graph `User.Read` permission used for the OBO exchange, and
       trusts the container app's user-assigned managed identity through a
       federated identity credential (FIC) — so OBO needs NO client secret.

  To break the circular dependency between the two apps, deploy the client
  first and pass its appId into the server deployment as `knownClientAppId`
  (see main.bicep). The client app does NOT reference the server scope; it
  relies purely on pre-authorization.
*/

extension microsoftGraphV1

@description('Display name for the Entra application')
param entraAppDisplayName string

@description('Unique name for the Entra application')
param entraAppUniqueName string

@description('True for the OBO server app; false for the SPA client app')
param isServer bool

@description('Value of the delegated scope exposed by the server app')
param entraAppScopeValue string = 'access_as_user'

@description('Display name of the delegated scope')
param entraAppScopeDisplayName string = 'Access the OBO MCP server as the signed-in user'

@description('Description of the delegated scope')
param entraAppScopeDescription string = 'Allows the agent to call Microsoft Graph on behalf of the signed-in user.'

@description('App id of the SPA client to pre-authorize on the server app (server only)')
param knownClientAppId string = ''

@description('Redirect URIs for the SPA client app (client only)')
param spaRedirectUris array = []

@description('Object (principal) id of the container app user-assigned managed identity. Required when isServer is true — it is the FIC subject.')
param acaManagedIdentityObjectId string = ''

@description('FIC token-exchange audience. Public cloud: api://AzureADTokenExchange.')
param tokenExchangeAudience string = 'api://AzureADTokenExchange'

@description('Optional Service Management Reference GUID for the Entra application.')
param serviceManagementReference string = ''

// Well-known identifiers.
var vsCodeClientAppId = 'aebc6443-996d-45c2-90f0-388ff96faa56'
var msGraphAppId = '00000003-0000-0000-c000-000000000000'
var graphUserReadScopeId = 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'

var scopeId = guid(entraAppUniqueName, entraAppScopeValue)

resource entraApp 'Microsoft.Graph/applications@v1.0' = {
  uniqueName: entraAppUniqueName
  displayName: entraAppDisplayName
  serviceManagementReference: !empty(serviceManagementReference) ? serviceManagementReference : null
  api: isServer ? {
    oauth2PermissionScopes: [
      {
        id: scopeId
        type: 'User'
        adminConsentDescription: entraAppScopeDescription
        adminConsentDisplayName: entraAppScopeDisplayName
        userConsentDescription: entraAppScopeDescription
        userConsentDisplayName: entraAppScopeDisplayName
        value: entraAppScopeValue
        isEnabled: true
      }
    ]
    preAuthorizedApplications: [
      {
        appId: knownClientAppId
        delegatedPermissionIds: [scopeId]
      }
      {
        appId: vsCodeClientAppId
        delegatedPermissionIds: [scopeId]
      }
    ]
    requestedAccessTokenVersion: 2
  } : null
  // The server app needs delegated Microsoft Graph User.Read for the OBO exchange.
  requiredResourceAccess: isServer ? [
    {
      resourceAppId: msGraphAppId
      resourceAccess: [
        {
          id: graphUserReadScopeId
          type: 'Scope'
        }
      ]
    }
  ] : []
  // The client app is a Single-Page Application (MSAL.js in the browser).
  spa: !isServer ? {
    redirectUris: spaRedirectUris
  } : null
}

// Second pass: set the server app's identifierUri once its appId is known.
resource entraAppUpdate 'Microsoft.Graph/applications@v1.0' = if (isServer) {
  uniqueName: entraAppUniqueName
  displayName: entraAppDisplayName
  serviceManagementReference: !empty(serviceManagementReference) ? serviceManagementReference : null
  identifierUris: ['api://${entraApp.appId}']
  api: {
    oauth2PermissionScopes: entraApp.api.oauth2PermissionScopes
    preAuthorizedApplications: entraApp.api.preAuthorizedApplications
    requestedAccessTokenVersion: 2
  }
}

// Service principal so the app is usable for sign-in / consent in this tenant.
resource servicePrincipal 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: entraApp.appId
}

// Federated identity credential: trust the container app's UAMI to mint the
// server app's client assertion (replaces a client secret for OBO).
resource federatedIdentityCredential 'Microsoft.Graph/applications/federatedIdentityCredentials@v1.0' = if (isServer) {
  name: '${entraApp.uniqueName}/OboServerCredential'
  audiences: [tokenExchangeAudience]
  description: 'Token-exchange credential for the OBO MCP server app registration'
  issuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
  subject: acaManagedIdentityObjectId
}

// Microsoft Graph service principal (always exists in the tenant) — referenced
// so we can pre-grant admin consent for the delegated User.Read permission.
resource msGraphServicePrincipal 'Microsoft.Graph/servicePrincipals@v1.0' existing = {
  appId: msGraphAppId
}

// Admin consent for the server app's delegated Graph User.Read, granted at
// deploy time so OBO works non-interactively without a manual consent step.
resource graphAdminConsent 'Microsoft.Graph/oauth2PermissionGrants@v1.0' = if (isServer) {
  clientId: servicePrincipal.id
  consentType: 'AllPrincipals'
  resourceId: msGraphServicePrincipal.id
  scope: 'User.Read'
}

output entraAppClientId string = entraApp.appId
output entraAppObjectId string = entraApp.id
output entraAppIdentifierUri string = 'api://${entraApp.appId}'
output entraAppScopeValue string = entraAppScopeValue
output entraAppScopeId string = isServer ? entraApp.api.oauth2PermissionScopes[0].id : ''
