> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Text-to-Music

> Endpoint for requesting text2music inference

Text-to-Music generates music tracks from text descriptions. You can control genre, tempo, key, time signature, and even provide lyrics. Optionally upload a `reference_audio` file for style transfer — the model will use it as a stylistic reference for the generated track. The endpoint returns a task ID to track processing status. Ideal for apps needing automated music creation — background tracks, jingles, or full songs with vocals.

<Note>
  **Prerequisite:** To ensure a successful request, you must first consult the [Model Selection](/api/utilities/model-selection) endpoint to identify a valid model `slug` and check specific **limits**.
</Note>

<Warning>
  **Reference audio requirements (optional):**

  * Supported formats: MP3, WAV, FLAC, OGG, M4A
  * Maximum file size: 10 MB
  * Duration must be within model-specific limits

  This endpoint uses `multipart/form-data` content type to support file uploads.
</Warning>


## OpenAPI

````yaml openapi.json post /api/v1/client/txt2music
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
  /api/v1/client/txt2music:
    post:
      tags:
        - Client API
      description: Endpoint for requesting text2music inference
      operationId: requestTxt2Music
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
      requestBody:
        description: Music generation parameters
        required: true
        content:
          multipart/form-data:
            schema:
              required:
                - caption
                - model
                - lyrics
                - duration
                - inference_steps
                - guidance_scale
                - seed
                - format
              properties:
                caption:
                  description: Text description of the music to generate
                  type: string
                  example: upbeat electronic dance music with energetic synths
                model:
                  description: >-
                    The model to use for music generation. Available models can
                    be retrieved via the GET /api/v1/client/models endpoint.
                  type: string
                  example: ACE-Step-v1.5-turbo
                lyrics:
                  description: >-
                    Lyrics for the music. Use "[Instrumental]" for instrumental
                    tracks without vocals.
                  type: string
                  example: '[Instrumental]'
                duration:
                  description: Duration in seconds (10-600)
                  type: number
                  example: 30
                bpm:
                  description: Beats per minute (30-300)
                  type: integer
                  example: 120
                  nullable: true
                keyscale:
                  description: Musical key/scale (e.g. "C major", "F# minor")
                  type: string
                  example: C major
                  nullable: true
                timesignature:
                  description: Time signature. Must be 2, 3, 4, or 6.
                  type: integer
                  example: 4
                  nullable: true
                vocal_language:
                  description: Language code for vocals (e.g. "en", "es", "fr")
                  type: string
                  example: en
                  nullable: true
                inference_steps:
                  description: >-
                    Number of diffusion inference steps (1-100). Use 8 for turbo
                    models, 32+ for base models.
                  type: integer
                  example: 8
                guidance_scale:
                  description: Classifier-free guidance scale (0-20)
                  type: number
                  example: 7
                seed:
                  description: Random seed. Use -1 for random.
                  type: integer
                  example: -1
                format:
                  description: Audio output format
                  type: string
                  example: flac
                reference_audio:
                  description: >-
                    Optional reference audio file for style transfer. Supported
                    formats: mp3, wav, flac, ogg, m4a. Max size configurable
                    (default 10MB). Duration must be within model-specific
                    limits.
                  type: string
                  format: binary
                  nullable: true
                webhook_url:
                  description: >-
                    Optional HTTPS URL to receive webhook notifications for job
                    status changes (processing, completed, failed). Must be
                    HTTPS. Max 2048 characters.
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