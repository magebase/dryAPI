> ## Documentation Index
> Fetch the complete documentation index at: https://dryapi.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Text-to-Speech (TTS)

> Endpoint for requesting text2audio inference

Text-to-Speech converts text into natural-sounding audio. The endpoint supports three TTS modes via the `mode` parameter:

* **`custom_voice`** (default) — Use a preset voice from the model's voice library. Requires the `voice` parameter.
* **`voice_clone`** — Clone a voice from a short reference audio clip. Requires the `ref_audio` parameter (3–10 seconds, max 10 MB). Optionally provide `ref_text` with a transcript of the reference audio for improved accuracy.
* **`voice_design`** — Create a new voice from a natural language description. Requires the `instruct` parameter (e.g. `"A warm female voice with a British accent"`).

<Note>
  **Prerequisite:** To ensure a successful request, you must first consult the [Model Selection](/api/utilities/model-selection) endpoint to identify a valid model `slug`, check specific **limits** and **features**, and verify available **languages** and **voices**.
</Note>

<Warning>
  **Mode-specific required fields:**

  * `custom_voice` — `voice` is required.
  * `voice_clone` — `ref_audio` is required. `ref_text` is optional but recommended.
  * `voice_design` — `instruct` is required.

  If `mode` is omitted, the API defaults to `custom_voice`.
</Warning>


## OpenAPI

````yaml openapi.json post /api/v1/client/txt2audio
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
  /api/v1/client/txt2audio:
    post:
      tags:
        - Client API
      description: Endpoint for requesting text2audio inference
      operationId: requestTxt2Audio
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
      requestBody:
        description: >-
          Audio generation parameters. Supports three TTS modes: custom_voice
          (default, preset speakers), voice_clone (clone from reference audio),
          voice_design (create voice from description).
        required: true
        content:
          multipart/form-data:
            schema:
              required:
                - text
                - model
                - lang
                - speed
                - format
                - sample_rate
              properties:
                text:
                  description: Text to be converted to speech
                  type: string
                  example: A beautiful sunset over mountains
                model:
                  description: >-
                    The model to use for speech generation. Available models can
                    be retrieved via the GET /api/v1/client/models endpoint.
                  type: string
                  example: Kokoro
                mode:
                  description: >-
                    TTS mode: custom_voice (default), voice_clone, or
                    voice_design. Determines which fields are required.
                  type: string
                  enum:
                    - custom_voice
                    - voice_clone
                    - voice_design
                  example: custom_voice
                  nullable: true
                voice:
                  description: >-
                    Name of the voice to be used. Required for custom_voice
                    mode.
                  type: string
                  example: af_sky
                  nullable: true
                lang:
                  description: Language to be used during audio generation
                  type: string
                  example: en-us
                speed:
                  description: Generated audio speech speed
                  type: number
                  example: 1
                format:
                  description: Audio output format
                  type: string
                  example: flac
                sample_rate:
                  description: Sample rate of generated audio
                  type: number
                  example: 24000
                ref_audio:
                  description: >-
                    Reference audio file for voice cloning. Supported formats:
                    mp3, wav, flac, ogg, m4a. Max 10MB. Duration must be between
                    3-10 seconds (model-specific limits may apply). Required for
                    voice_clone mode.
                  type: string
                  format: binary
                  nullable: true
                ref_text:
                  description: >-
                    Optional transcript of the reference audio for improved
                    voice cloning accuracy.
                  type: string
                  nullable: true
                instruct:
                  description: >-
                    Natural language voice description for voice_design mode
                    (e.g. "A warm female voice with a British accent"), or
                    style/emotion control in custom_voice mode.
                  type: string
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