export type DeapiModelDetail = {
  displayName: string
  summary: string
  primaryUse: string
  huggingFaceUrl: string
  huggingFaceRepo: string | null
  sourceNote: string
}

export type DeapiModelDetailsDataset = {
  generatedAt: string
  models: Record<string, DeapiModelDetail>
}
