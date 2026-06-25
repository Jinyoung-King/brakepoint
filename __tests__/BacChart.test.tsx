import renderer, { act } from 'react-test-renderer';

import BacChart from '../src/BacChart';
import { darkColors } from '../src/theme';
import type { BacPoint } from '../src/bac';

const pts: BacPoint[] = [
  { t: 1000, bac: 0.05 },
  { t: 2000, bac: 0.045 },
  { t: 3000, bac: 0.02 },
  { t: 4000, bac: 0 },
];

describe('BacChart', () => {
  it('2점 이상이면 크래시 없이 렌더된다', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BacChart points={pts} nowMs={2500} driveLimit={0.03} c={darkColors} />
      );
    });
    expect(tree!.toJSON()).toBeTruthy();
  });

  it('점이 2개 미만이면 아무것도 렌더하지 않는다', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BacChart points={[{ t: 0, bac: 0.05 }]} nowMs={0} driveLimit={0.03} c={darkColors} />
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });
});
