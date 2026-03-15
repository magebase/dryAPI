declare module "gradient-gl" {
  export interface GradientGLProgram {
    destroy: () => void
  }

  export default function gradientGL(seed: string, selector?: string): Promise<GradientGLProgram>
}
