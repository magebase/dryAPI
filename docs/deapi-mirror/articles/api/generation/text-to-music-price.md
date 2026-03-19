> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Text-to-Music Price Calculation

> Endpoint for calculating price for text2music inference. Requires duration and inference_steps parameters.



## OpenAPI

````yaml openapi.json post /api/v1/client/txt2music/price-calculation
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
  /api/v1/client/txt2music/price-calculation:
    post:
      tags:
        - Client API
      description: >-
        Endpoint for calculating price for text2music inference. Requires
        duration and inference_steps parameters.
      operationId: requestPriceForTxt2Music
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
      requestBody:
        description: Music generation parameters for price calculation.
        required: true
        content:
          application/json:
            schema:
              required:
                - model
                - duration
                - inference_steps
              properties:
                model:
                  description: >-
                    The model to use for music generation. Available models can
                    be retrieved via the GET /api/v1/client/models endpoint.
                  type: string
                  example: ACE-Step-v1.5-turbo
                duration:
                  description: Duration in seconds (10-600)
                  type: number
                  example: 30
                inference_steps:
                  description: >-
                    Number of diffusion inference steps (1-100). Use 8 for turbo
                    models, 32+ for base models.
                  type: integer
                  example: 8
              type: object
      responses:
        '200':
          description: Calculated price for text2music inference.
          content:
            application/json:
              schema:
                properties:
                  data:
                    properties:
                      price:
                        description: Calculated price for the inference
                        type: number
                        format: float
                        example: 0.25
                    type: object
                type: object
        '401':
          description: Unauthorized user.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
        '404':
          description: Model not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
        '422':
          $ref: '#/components/responses/ValidationError'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'
      security:
        - bearerAuth: []
components:
  parameters:
    AcceptHeader:
      name: Accept
      in: header
      required: true
      schema:
        type: string
        default: application/json
        enum:
          - application/json
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
    response_error_rate_limit:
      description: Rate limit exceeded response
      properties:
        message:
          description: Error message
          type: string
          example: Too Many Attempts.
      type: object
  responses:
    ValidationError:
      description: >-
        Validation failed. Common errors include: model does not exist, model
        does not support the inference type for this endpoint, or invalid
        request parameters.
      content:
        application/json:
          schema:
            properties:
              message:
                description: General error message
                type: string
                example: The selected model does not support Text To Image.
              errors:
                description: Detailed validation errors by field
                type: object
                example:
                  model:
                    - The selected model does not support Text To Image.
            type: object
    RateLimitExceeded:
      description: >-
        Rate limit exceeded. Check X-RateLimit-Type header to determine if
        minute (RPM) or daily (RPD) limit was hit.
      headers:
        X-RateLimit-Limit:
          description: Maximum requests allowed per minute (RPM)
          schema:
            type: integer
            example: 3
        X-RateLimit-Remaining:
          description: Remaining requests in current minute window
          schema:
            type: integer
            example: 0
        X-RateLimit-Daily-Limit:
          description: Maximum requests allowed per day (RPD)
          schema:
            type: integer
            example: 100
        X-RateLimit-Daily-Remaining:
          description: Remaining requests in current day window
          schema:
            type: integer
            example: 95
        X-RateLimit-Type:
          description: 'Type of rate limit exceeded: "minute" for RPM, "daily" for RPD'
          schema:
            type: string
            enum:
              - minute
              - daily
            example: minute
        Retry-After:
          description: >-
            Seconds until rate limit resets (60 for minute, up to 86400 for
            daily)
          schema:
            type: integer
            example: 60
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/response_error_rate_limit'
  securitySchemes:
    bearerAuth:
      type: http
      bearerFormat: JWT
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).