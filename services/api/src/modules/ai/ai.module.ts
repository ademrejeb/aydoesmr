import { Module } from "@nestjs/common"
import { AiController } from "./ai.controller"
import { AiService } from "./ai.service"
import { EncryptionService } from "./encryption.service"

/** AI provider integration: cloud, hosted and local model providers (OpenAI-compatible, Anthropic, Gemini, Ollama...). */
@Module({
  controllers: [AiController],
  providers: [AiService, EncryptionService],
  exports: [AiService, EncryptionService],
})
export class AiModule {}