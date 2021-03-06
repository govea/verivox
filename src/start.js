import express from 'express'
// enable async/await for express middleware
import 'express-async-errors'
import logger from 'loglevel'
import config from '../config'
import seedDb from './db/seed-db'
// all the routes for my app are retrieved from the src/routes/index.js module
import {getRoutes} from './routes'

function startServer({port = config.PORT} = {}) {
  const app = express()

  app.use('/api', getRoutes())
  app.use(errorMiddleware)

  return new Promise(resolve => {
    const server = app.listen(port, () => {
      seedDb()
      logger.info(`Listening on port ${port} 🚀`)

      // this block of code turns `server.close` into a promise API
      const originalClose = server.close.bind(server)
      server.close = () => {
        return new Promise(resolveClose => {
          originalClose(resolveClose)
        })
      }
      setupCloseOnExit(server)
      resolve(server)
    })
  })
}

// here's our generic error handler for situations where we didn't handle
// errors properly
function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    next(error)
  } else {
    logger.error(error)
    res.status(500)
    res.json({
      message: error.message,
      // we only add a `stack` property in non-production environments
      ...(process.env.NODE_ENV === 'production' ? null : {stack: error.stack}),
    })
  }
}

// ensures we close the server in the event of an error.
function setupCloseOnExit(server) {
  // thank you stack overflow
  // https://stackoverflow.com/a/14032965/971592
  async function exitHandler(options = {}) {
    await server
      .close()
      .then(() => {
        logger.info('Server successfully closed')
      })
      .catch(e => {
        logger.warn('Something went wrong closing the server', e.stack)
      })

    if (options.exit) process.exit()
  }

  // do something when app is closing
  process.on('exit', exitHandler)

  // catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, {exit: true}))

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, {exit: true}))
  process.on('SIGUSR2', exitHandler.bind(null, {exit: true}))

  // catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, {exit: true}))
}

export {startServer}