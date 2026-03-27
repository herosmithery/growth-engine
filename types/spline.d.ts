declare module '@splinetool/react-spline' {
  import { ComponentType } from 'react';

  interface SplineProps {
    scene: string;
    className?: string;
    onLoad?: (spline: unknown) => void;
    onSplineMouseDown?: (e: unknown) => void;
    onSplineMouseUp?: (e: unknown) => void;
    onSplineMouseHover?: (e: unknown) => void;
  }

  const Spline: ComponentType<SplineProps>;
  export default Spline;
}
