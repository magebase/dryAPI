> ## Documentation Index
> Fetch the complete documentation index at: https://docs.deapi.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Image-to-Image Prompt Booster

> Enhance image-to-image transformation prompts with visual context awareness. Requires a reference image.

<Note>
  **Visual context required:** This endpoint requires a reference image. The enhancement is tailored specifically to work with your source image's content, style, and composition.
</Note>


## OpenAPI

````yaml openapi.json post /api/v1/client/prompt/image2image
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
  /api/v1/client/prompt/image2image:
    post:
      tags:
        - Client API
      description: Enhance image-to-image prompts for better AI generation results
      operationId: clientEnhanceImage2ImagePrompt
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
          description: Enhanced prompts returned successfully
          content:
            application/json:
              schema:
                properties:
                  prompt:
                    type: string
                  negative_prompt:
                    type: string
                    nullable: true
                type: object
        '422':
          description: Validation failed or insufficient GHX balance
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