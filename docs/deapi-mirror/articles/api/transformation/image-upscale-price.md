> ## Documentation Index
> Fetch the complete documentation index at: https://docs.deapi.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Image Upscale Price Calculation

> Endpoint for calculating price for image upscaling inference



## OpenAPI

````yaml openapi.json post /api/v1/client/img-upscale/price-calculation
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
  /api/v1/client/img-upscale/price-calculation:
    post:
      tags:
        - Client API
      description: Endpoint for calculating price for image upscaling inference
      operationId: requestPriceForImgUpscale
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
      requestBody:
        description: Image upscaling parameters
        required: true
        content:
          multipart/form-data:
            schema:
              oneOf:
                - required:
                    - image
                    - model
                  properties:
                    image:
                      description: >-
                        Image file to upscale. Supported formats: JPG, JPEG,
                        PNG, GIF, BMP, WebP. Maximum file size: 10 MB.
                      type: string
                      format: binary
                    model:
                      description: The upscaling model to use
                      type: string
                      example: RealESRGAN_x4plus
                  type: object
                - required:
                    - width
                    - height
                    - model
                  properties:
                    width:
                      description: Width of image in pixels for price calculation
                      type: integer
                      example: 1920
                    height:
                      description: Height of image in pixels for price calculation
                      type: integer
                      example: 1080
                    model:
                      description: The upscaling model to use
                      type: string
                      example: RealESRGAN_x4plus
                  type: object
      responses:
        '200':
          description: Calculated price for image upscaling inference.
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
                        example: 0.15
                    type: object
                type: object
        '401':
          description: Unauthorized user.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
        '404':
          description: Not found.
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