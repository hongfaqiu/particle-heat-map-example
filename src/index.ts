import { Rectangle, Viewer } from 'cesium';
import './index.css';
import ParticleHeatMap from './ParticleHeatMap';

function generateMatrixData(x: number, y: number) {
  const data: number[][] = [];

  for (let j = 0; j < x; j += 1) {
    let col = [];
    for (let i = 0; i < y; i += 1) {
      col.push(Math.random() * 2 - 1)
    }
    data.push(col);
  }

  return data;
}

const viewer = new Viewer('cesiumContainer', {
  shouldAnimate: true,
  useBrowserRecommendedResolution: false,
});

const rectangle = Rectangle.fromDegrees(115, 55, 120, 60);

const particleHeatMapObj = new ParticleHeatMap(viewer, {
  rectangle,
  data: generateMatrixData(10, 10),
  renderOptions: {
    emissionRate: 3000,
    height: 10000,
  }
})

particleHeatMapObj.init(true)