> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Image-to-Image Prompt Booster Price

> Calculate the cost of enhancing an image-to-image transformation prompt before execution.



## OpenAPI

````yaml openapi.json post /api/v1/client/prompt/image2image/price-calculation
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
  /api/v1/client/prompt/image2image/price-calculation:
    post:
      tags:
        - Client API
      description: Calculate the price for enhancing image-to-image prompts
      operationId: clientCalculateImage2ImagePromptBoosterPrice
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              properties:
                prompt:
                  type: string
                  minLength: 3
                  example: A beautiful landscape with mountains
                negative_prompt:
                  type: string
                  minLength: 3
                  example: blurry, low quality
                  nullable: true
                image:
                  description: >-
                    Reference image for image-to-image transformation. Supported
                    formats: JPEG, PNG, BMP, GIF, SVG, WebP.
                  type: string
                  format: binary
              type: object
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