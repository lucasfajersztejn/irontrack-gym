import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.js'],
    // Un único worker: cada test limpia colecciones de la misma Mongo
    // in-memory. Con workers paralelos tendríamos carreras entre suites.
    fileParallelism: false,
    // mongodb-memory-server baja el binario en el primer uso: necesita
    // margen aunque el resto del test tarde milisegundos.
    testTimeout: 30000,
    // La primera corrida baja un binario de ~500 MB; a partir de ahí
    // el cache de ~/.cache/mongodb-binaries hace el arranque instantáneo.
    hookTimeout: 10 * 60 * 1000,
  },
})
