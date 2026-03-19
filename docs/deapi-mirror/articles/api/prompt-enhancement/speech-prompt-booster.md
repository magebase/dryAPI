> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Speech Prompt Booster

> Enhance text-to-speech input for more natural, expressive audio generation.

<Note>
  **Language support:** Specify the `lang_code` parameter to optimize the text for a specific language's pronunciation and phrasing patterns.
</Note>


## OpenAPI

````yaml openapi.json post /api/v1/client/prompt/speech
openapi: 3.0.0
info:
  title: dryAPI REST API
  description: >-
    Decentralized AI inference API for image generation, video processing, audio
    transcription, and more.
  contact:
    name: dryAPI Support
    url: https://dryapi.dev
    email: support@dryapi.dev
  version: 0.0.1
servers:
  - url: https://api.dryapi.dev
    description: Production API Server base URL
security:
  - bearerAuth: []
tags:
  - name: Client API
    description: Endpoints for client operations
paths:
  /api/v1/client/prompt/speech:
    post:
      tags:
        - Client API
      description: Enhance text-to-speech prompts for better AI generation results
      operationId: clientEnhanceText2SpeechPrompt
      requestBody:
        required: true
        content:
          application/json:
            schema:
              properties:
                prompt:
                  type: string
                  minLength: 3
                  example: A beautiful landscape
                lang_code:
                  type: string
                  example: en
                  nullable: true
              type: object
      responses:
        '200':
          description: Enhanced prompts returned successfully
          content:
            application/json:
              schema:
                properties:
                  prompt:
                    type: string
                type: object
        '422':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_unprocessable_entity'
      security:
        - bearerAuth: []
components:
  schemas:
    response_error_unprocessable_entity:
      properties:
        data:
          description: Information from success endpoint
          type: object
        message:
          description: Error general message
          type: string
        errors:
          description: Information about errors
          type: array
          items:
            properties:
              field:
                description: Field name
                type: string
              messages:
                description: Array of error messages
                type: array
                items: {}
            type: object
        statusCode:
          description: Status code
          type: integer
      type: object
  securitySchemes:
    bearerAuth:
      type: http
      bearerFormat: JWT
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).