> ## Documentation Index
> Fetch the complete documentation index at: https://docs.deapi.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Model Selection

> Endpoint for fetching all available models.



## OpenAPI

````yaml openapi.json get /api/v1/client/models
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
  /api/v1/client/models:
    get:
      tags:
        - Client API
      description: Endpoint for fetching all available models.
      operationId: clientModels
      parameters:
        - $ref: '#/components/parameters/AcceptHeader'
        - name: per_page
          in: query
          required: false
          schema:
            type: integer
            default: 15
        - name: page
          in: query
          required: false
          schema:
            type: integer
            default: 1
        - name: filter[inference_types]
          in: query
          description: >-
            Comma-separated list of inference types to filter by. Example:
            txt2img,txt2audio
          required: false
          style: form
          explode: false
          schema:
            type: array
            items:
              type: string
              enum:
                - txt2img
                - img2txt
                - txt2audio
                - vid2txt
                - aud2txt
                - txt2video
                - img2video
                - img2img
                - img_upscale
                - img_rmbg
                - vid_upscale
                - vid_rmbg
                - txt2embedding
                - videofile2txt
                - audiofile2txt
      responses:
        '200':
          description: List of available models.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ClientDiffusionModelCollection'
        '401':
          description: Unauthorized user.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
        '404':
          description: Request not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/response_error_default'
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
    ClientDiffusionModelCollection:
      properties:
        data:
          description: List of available models
          type: array
          items:
            $ref: '#/components/schemas/ClientDiffusionModelResource'
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
    ClientDiffusionModelResource:
      properties:
        name:
          type: string
        slug:
          type: string
        inference_types:
          description: >-
            Available inference types for this model with their specific
            configurations
          type: object
        info:
          description: >-
            Model specifications including limits, features, and defaults.
            Structure varies by model type.
          type: object
          example:
            limits:
              min_width: 64
              max_width: 2048
              min_height: 64
              max_height: 2048
              min_steps: 1
              max_steps: 150
              min_cfg_scale: 1
              max_cfg_scale: 30
              min_duration: 0.5
              max_duration: 10
              min_fps: 8
              max_fps: 30
            features:
              supports_last_frame: true
              supports_negative_prompt: true
              supports_controlnet: false
              supports_lora: true
              supports_voice_presets: true
              supports_custom_voice: false
            defaults:
              width: 512
              height: 512
              steps: 20
              cfg_scale: 7.5
              negative_prompt: no disfigurations
              fps: 24
              duration: 4
              voice: alloy
          additionalProperties: true
        loras:
          description: >-
            Available LoRA models for this diffusion model. Only present when
            the model supports LoRA and has LoRA models available.
          type: array
          items:
            $ref: '#/components/schemas/ClientLoraResource'
          nullable: true
        languages:
          description: >-
            Available languages and voices for this model. Only present for TTS
            models that support multiple languages.
          type: array
          items:
            $ref: '#/components/schemas/ClientLanguageResource'
          nullable: true
      type: object
    response_error_rate_limit:
      description: Rate limit exceeded response
      properties:
        message:
          description: Error message
          type: string
          example: Too Many Attempts.
      type: object
    ClientLoraResource:
      properties:
        display_name:
          description: Human friendly Lora name
          type: string
        name:
          description: Lora name
          type: string
      type: object
    ClientLanguageResource:
      properties:
        name:
          description: Language display name
          type: string
        slug:
          description: Language identifier slug
          type: string
        voices:
          description: Available voices for this language
          type: array
          items:
            $ref: '#/components/schemas/ClientVoiceResource'
      type: object
    ClientVoiceResource:
      properties:
        name:
          description: Voice display name
          type: string
        slug:
          description: Voice identifier slug
          type: string
        gender:
          description: Voice gender classification
          type: string
          nullable: true
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