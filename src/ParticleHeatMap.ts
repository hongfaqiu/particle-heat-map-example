/* eslint-disable no-param-reassign */
import { BoxEmitter, Cartesian2, Cartesian3, Color, Entity, Math as CMath, ParticleSystem, Rectangle, Transforms, Viewer } from 'cesium';
import type { Particle, Scene} from 'cesium';


export type ParticleHeatMapRenderOptions = {
  emissionRate?: number;
  startColor?: string;
  upColor?: string;
  downColor?: string;
  lifetime?: number;
  scale?: number;
  maximumSpeed?: number;
  endScale?: number;
  height?: number;
};

const defaultOptions: Required<ParticleHeatMapRenderOptions> = {
  emissionRate: 1000.0,
  scale: 10,
  maximumSpeed: 1.0,
  height: 1000,
  endScale: 1.0,
  startColor: 'rgba(0, 247, 255, 1)',
  upColor: 'rgba(255, 255, 0, 1)',
  downColor: 'rgba(0, 0, 255, 1)',
  lifetime: 12.0,
};

export type ParticleHeatMapOptions = {
  rectangle: Rectangle;
  data: number[][];
  renderOptions?: ParticleHeatMapRenderOptions;
};

export default class ParticleHeatMap {
  renderOptions: Required<ParticleHeatMapRenderOptions>;
  particleSystem: ParticleSystem | null = null;
  particleParticleSize = 12.0;
  rectangle: Rectangle;
  data: number[][];
  viewer: Viewer;
  scene: Scene;

  constructor(viewer: Viewer, options: ParticleHeatMapOptions) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.rectangle = options.rectangle;
    this.data = options.data;
    this.renderOptions = { ...defaultOptions, ...options.renderOptions };
  }

  get center() {
    const { west, south, width, height } = this.rectangle;
    let lon = west + width / 2;
    if (lon > Math.PI) {
      lon -= CMath.TWO_PI;
    }
    const lat = south + height / 2;
    return [lon, lat];
  }

  public init(resetCamera = false) {
    const { west, south, east, north } = this.rectangle;
    const { emissionRate, lifetime, startColor, maximumSpeed, endScale, height } = this.renderOptions;
    if (resetCamera) {
      // 重置视角,避免卡顿
      this.resetCamera();
    }
    const lonDistance = Cartesian3.distance(
      Cartesian3.fromRadians(west, north),
      Cartesian3.fromRadians(east, north),
    );
    const latDistance = Cartesian3.distance(
      Cartesian3.fromRadians(west, north),
      Cartesian3.fromRadians(west, south),
    );
    this.particleSystem = new ParticleSystem({
      image: '/smoke.png',
      minimumSpeed: 0.0,
      maximumSpeed,
      startScale: 0.5,
      endScale,
      emissionRate,
      emitter: new BoxEmitter(new Cartesian3(lonDistance, latDistance, 1)),
      imageSize: new Cartesian2(25.0, 25.0),
      modelMatrix: Transforms.eastNorthUpToFixedFrame(
        Cartesian3.fromRadians(this.center[0], this.center[1], height),
      ),
      minimumParticleLife: 1.0,
      lifetime,
      startColor: Color.fromCssColorString(startColor).withAlpha(0),
      minimumImageSize: new Cartesian2(this.particleParticleSize, this.particleParticleSize),
      maximumImageSize: new Cartesian2(
        this.particleParticleSize * 2.0,
        this.particleParticleSize * 2.0,
      ),
      updateCallback: this.particleCallback.bind(this),
    });
    this.scene.primitives.add(this.particleSystem);
  }

  // 对单个粒子进行计算
  private particleCallback(particle: Particle, dt: number) {
    if (this.particleSystem === null) {
      return;
    }
    const { ellipsoid } = this.scene.globe;
    const cartographic = ellipsoid.cartesianToCartographic(particle.position);
    const { longitude, latitude } = cartographic

    const { upColor, downColor } = this.renderOptions;

    const width = this.data[0].length;
    const height = this.data.length;
    
    const { west, north, width: lonWidth, height: latWidth } = this.rectangle;
    let lonGap = longitude - west;
    // 处理跨180°经线的情况
    if (longitude < 0 && west > 0) {
      lonGap += (Math.PI * 2);
    }
    const posX = ~~(Math.abs(lonGap / lonWidth) * width);
    const posY = ~~(Math.abs((north - latitude) / latWidth) * height);
    const value = this.data[posY]?.[posX];
    
    if (isNaN(value)) {
      particle.startColor.alpha = 0;
      particle.endColor.alpha = 0;
      particle.image = null
      return;
    };

    let particleGravityScratch = new Cartesian3();
    particleGravityScratch = Cartesian3.normalize(particle.position, particleGravityScratch);
    
    particleGravityScratch = Cartesian3.multiplyByScalar(
      particleGravityScratch,
      value * 10 * (this.renderOptions.scale ?? 1),
      particleGravityScratch,
    );

    particle.velocity = Cartesian3.add(
      particle.velocity,
      particleGravityScratch,
      particle.velocity,
    );
    if (value > 0) {
      particle.endColor = Color.fromCssColorString(upColor);
    } else {
      particle.endColor = Color.fromCssColorString(downColor);
    }

  }

  public resetCamera(duration = 1) {
    const { width: lonWidth, height: latWidth } = this.rectangle;
    const height = CMath.toDegrees(Math.max(lonWidth, latWidth)) * 80000 + this.renderOptions.height;
    this.scene.camera.flyTo({
      destination: Cartesian3.fromRadians(
        this.center[0],
        this.center[1] - latWidth * 1.5,
        height,
      ),
      orientation: {
        heading: CMath.toRadians(0),
        pitch: CMath.toRadians(-35),
        roll: CMath.toRadians(0),
      },
      duration,
    });
  }

  public update(options: ParticleHeatMapRenderOptions) {
    if (this.particleSystem) {
      const { emissionRate, lifetime, startColor, maximumSpeed, endScale, height } = this.renderOptions;
      this.renderOptions = { ...this.renderOptions, ...options };
      if (emissionRate !== undefined) {
        this.particleSystem.emissionRate = emissionRate;
      }
      if (startColor !== undefined) {
        this.particleSystem.startColor = Color.fromCssColorString(startColor).withAlpha(0);
      }
      if (maximumSpeed !== undefined) {
        this.particleSystem.maximumSpeed = maximumSpeed;
      }
      if (endScale !== undefined) {
        this.particleSystem.endScale = endScale;
      }
      if (lifetime !== undefined) {
        this.particleSystem.lifetime = lifetime;
      }
      if (height !== undefined) {
        this.particleSystem.modelMatrix = Transforms.eastNorthUpToFixedFrame(
          Cartesian3.fromRadians(this.center[0], this.center[1], height),
        );
      }
    }
  }

  public switchShow(show: boolean) {
    if (this.particleSystem) {
      this.particleSystem.show = show;
    } else {
      throw Error('have not initializated');
    }
  }

  public clear() {
    this.scene.primitives.remove(this.particleSystem);
    this.particleSystem = null;
  }
}
