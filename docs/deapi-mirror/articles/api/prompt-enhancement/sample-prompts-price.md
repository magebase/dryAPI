> ## Documentation Index
> Fetch the complete documentation index at: https://docs.deapi.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Sample Prompts Price

> Calculate the cost of generating sample prompts before execution.



## OpenAPI

````yaml openapi.json get /api/v1/client/prompts/samples/price-calculation
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
  /api/v1/client/prompts/samples/price-calculation:
    get:
      tags:
        - Client API
      description: Calculate the price for generating sample prompts
      operationId: clientCalculateSamplePromptsPrice
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
          description: Optional topic to base the prompt on
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
          description: Price calculation returned successfully
          content:
            application/json:
              schema:
                properties:
                  price:
                    type: number
                    format: float
                    example: 0.00012345
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