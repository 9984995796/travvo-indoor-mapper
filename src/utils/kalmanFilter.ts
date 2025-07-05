
export class KalmanFilter {
  public Q: number; // Process noise
  public R: number; // Measurement noise
  public P: number; // Estimation error covariance
  public K: number; // Kalman gain
  public X: number; // Value

  constructor(processNoise = 0.0001, measurementNoise = 0.01, estimation = 0) {
    this.Q = processNoise;
    this.R = measurementNoise;
    this.P = 1.0;
    this.K = 0;
    this.X = estimation;
  }

  filter(measurement: number) {
    // Prediction update
    this.P = this.P + this.Q;
    
    // Measurement update
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }
}

export const createKalmanFilters = (beacons: any[]) => {
  const filters: { [key: number]: KalmanFilter } = {};
  beacons.forEach(beacon => {
    filters[beacon.id] = new KalmanFilter();
  });
  return filters;
};
