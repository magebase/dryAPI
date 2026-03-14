> ## Documentation Index
> Fetch the complete documentation index at: https://docs.deapi.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Sample Prompts Generator

> Generate creative sample prompts for AI inference tasks. Perfect for inspiration, testing, or quick starting points.

<Note>
  **Supported types:** `text2image` and `text2speech`. Optionally provide a `topic` parameter to guide the generation toward a specific theme.
</Note>


## OpenAPI

````yaml openapi.json get /api/v1/client/prompts/samples
openapi: 3.0.0
info:
  title: deAPI REST API
  description: >-
    Decentralized AI inference API for image generation, video processing, audio
    transcription, and more.
  contact:
    name: deAPI Support
    url: https://deapi.ai
    email: support@deapi.ai
  version: 0.0.1
servers:
  - url: https://api.deapi.ai
    description: Production API Server base URL
security:
  - bearerAuth: []
tags:
  - name: Client API
    description: Endpoints for client operations
paths:
  /api/v1/client/prompts/samples:
    get:
      tags:
        - Client API
      description: >-
        Get sample prompts for AI inference tasks based on type and optional
        topic
      operationId: clientGetSamplePrompts
      parameters:
        - name: type
          in: query
          description: Type of sample prompt to generate
          required: true
          schema:
            type: string
            enum:
              - text2image
              - text2speech
            example: text2image
        - name: topic
          in: query
          description: >-
            Optional topic to base the prompt on. Uses default topics if not
            provided.
          required: false
          schema:
            type: string
            maxLength: 500
            example: cyberpunk cityscape at night
            nullable: true
        - name: lang_code
          in: query
          description: Optional language code for text-to-speech prompts
          required: false
          schema:
            type: string
            maxLength: 4
            example: en
            nullable: true
      responses:
        '200':
          description: Sample prompt generated successfully
          content:
            application/json:
              schema:
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    properties:
                      type:
                        type: string
                        example: text2image
                      prompt:
                        type: string
                        example: >-
                          A futuristic cyberpunk cityscape at night, neon lights
                          reflecting off wet streets, towering holographic
                          advertisements, flying cars weaving between glass
                          skyscrapers, cinematic composition, moody,
                          atmospheric, ultra-detailed digital art style.
                    type: object
                type: object
        '401':
          description: Unauthorized request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
        '422':
          description: Validation failed - invalid type or topic too long
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_unprocessable_entity'
        '500':
          description: Failed to generate sample prompt
          content:
            application/json:
              schema:
                properties:
                  success:
                    type: boolean
                    example: false
                  error:
                    type: string
                    example: Failed to generate sample prompt
                  message:
                    type: string
                    example: OpenAI API request failed
                type: object
      security:
        - bearerAuth: []
components:
  schemas:
    response_error_default:
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
          items: {}
        statusCode:
          description: Status code
          type: integer
      type: object
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