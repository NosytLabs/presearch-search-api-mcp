import { cacheManager } from '../src/utils/cache-manager';

export default () => {
  if (typeof cacheManager.destroy === 'function') {
    cacheManager.destroy();
  }
};