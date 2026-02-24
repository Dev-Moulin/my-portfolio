declare module 'troika-three-text' {
  import { Mesh, Material, Color } from 'three';

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: number | string | Color;
    anchorX: 'left' | 'center' | 'right' | number;
    anchorY: 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | number;
    textAlign: 'left' | 'right' | 'center' | 'justify';
    maxWidth: number;
    overflowWrap: 'normal' | 'break-word';
    material: Material;
    outlineWidth: number | string;
    outlineColor: number | string;
    outlineBlur: number | string;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
