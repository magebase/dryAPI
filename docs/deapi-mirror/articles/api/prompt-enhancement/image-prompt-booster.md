> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Image Prompt Booster

> Enhance text-to-image prompts for better AI generation results.

<Note>
  **Tip:** Provide at least a basic concept or subject. The more context you give, the more targeted the enhancement will be.
</Note>


## OpenAPI

````yaml openapi.json post /api/v1/client/prompt/image
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
  /api/v1/client/prompt/image:
    post:
      tags:
        - Client API
      description: Enhance text-to-image prompts for better AI generation results
      operationId: clientEnhanceText2ImagePrompt
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
                negative_prompt:
                  type: string
                  minLength: 3
                  example: blurry, low quality
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
        '429':
          $ref: '#/components/responses/RateLimitExceeded'
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
    response_error_rate_limit:
      description: Rate limit exceeded response
      properties:
        message:
          description: Error message
          type: string
          example: Too Many Attempts.
      type: object
  responses:
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