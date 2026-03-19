> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Image-to-Text (OCR)

> Endpoint for requesting image2text (OCR) inference

<Note>
  **Prerequisite:** To ensure a successful request, you must first consult the [Model Selection](/api/utilities/model-selection) endpoint to identify a valid model `slug`, check specific **limits** and **features**, and verify **LoRA** availability.
</Note>


## OpenAPI

````yaml openapi.json post /api/v1/client/img2txt
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
  /api/v1/client/img2txt:
    post:
      tags:
        - Client API
      description: Endpoint for requesting image2text (OCR) inference
      operationId: requestImg2Txt
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
      requestBody:
        description: Image to text conversion parameters
        required: true
        content:
          multipart/form-data:
            schema:
              required:
                - image
                - model
              properties:
                image:
                  description: >-
                    Image file to extract text from. Supported formats: JPG,
                    JPEG, PNG, GIF, BMP, WebP. Maximum file size: 10 MB.
                  type: string
                  format: binary
                model:
                  description: The OCR model to use for text extraction
                  type: string
                  example: Nanonets_Ocr_S_F16
                language:
                  description: Language code for OCR processing (optional)
                  type: string
                  example: en
                  nullable: true
                format:
                  description: Output format for extracted text
                  type: string
                  enum:
                    - text
                    - json
                  example: text
                  nullable: true
                return_result_in_response:
                  description: >-
                    If true, the result will be returned directly in the
                    response instead of only download url. Optional parameter.
                  type: boolean
                  default: false
                  example: false
                  nullable: true
                webhook_url:
                  description: >-
                    Optional HTTPS URL to receive webhook notifications for job
                    status changes (processing, completed, failed). Must be
                    HTTPS. Max 2048 characters. See [Webhook
                    Documentation](/execution-modes-and-integrations/webhooks)
                    for payload structure and authentication details.
                  type: string
                  format: uri
                  maxLength: 2048
                  example: https://your-server.com/webhooks/dryapi
                  nullable: true
              type: object
      responses:
        '200':
          description: ID of the inference request.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/JobRequestResponseResource'
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
    JobRequestResponseResource:
      properties:
        data:
          description: Information from success endpoint
          properties:
            request_id:
              description: Request Id
              required:
                - request_id
              type: string
              example: c08a339c-73e5-4d67-a4d5-231302fbff9a
          type: object
      type: object
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