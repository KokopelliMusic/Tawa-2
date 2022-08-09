import { Router, sdk, sipapu } from "./deps.ts";
import { db, env, teams, users } from "./db.ts";

const router = new Router();

router.get('/api/session/create-temp', async (ctx) => {
  const LETTERS = 'ABCDEFGHKNPRSTUVXYZ'

  try {
    const docs = await db.listDocuments('session')
    const names: string[] = []
    for (let i = 0; i < docs.total; i++) {
      names.push(docs.documents[i].$id)
    }
    
    let key = ''
    let found = false

    while (!found) {
      key = ''

      for (let i = 0; i < 4; i++) {
        key += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length))
      }

      if (!names.includes(key)) {
        found = true
      }
    }
  
    await db.createDocument('temp_session', key, {
      session_id: key
    })

    ctx.response.body = {
      status: 200,
      session_id: key
    }
  } catch (err) {
    ctx.response.status = 500
    ctx.response.body = {
      status: 500,
      error: err.message
    }
  }
})

router.post('/api/session/claim', async (ctx) => {
  const { value } = ctx.request.body({ type: 'json' })

  const payload = await value

  if (!payload.session_id) {
    ctx.response.status = 400
    ctx.response.body = {
      status: 400,
      error: 'session_id missing from request payload'
    }
    return
  }

  if (!payload.playlist_id) {
    ctx.response.status = 400
    ctx.response.body = {
      status: 400,
      error: 'playlist_id missing from request payload'
    }
    return
  }

  if (!payload.user_id) {
    ctx.response.status = 400
    ctx.response.body = {
      status: 400,
      error: 'user_id missing from request payload'
    }
    return
  }

  try {
    const session = await db.listDocuments('temp_session', [
      sdk.Query.equal('session_id', payload.session_id)
    ])

    if (session.total === 0) {
      ctx.response.status = 400
      ctx.response.body = {
        status: 400,
        message: 'No sessions found with that session_id'
      }
      return
    }

    const user = await users.get(payload.user_id);

    // since there can only be one session with that id, select the first one
    const session_id = session.documents[0].$id

    // Create a new team for this session
    await teams.create(session_id, session_id)

    // and add this user to it.
    await teams.createMembership(session_id, user.email, [], env.APPWRITE_ENDPOINT)
  
    // Create the session in the database, giving r/w permission to everyone in the team.
    await db.createDocument('session', session_id, {
      settings: payload.settings ?? JSON.stringify(sipapu.DEFAULT_SETTINGS),
      playlist_id: payload.playlist_id,
      user_id: payload.user_id,
      users: [payload.user_id]
    }, 
      [`team:${session_id}`], 
      [`team:${session_id}`]
    )

    // Remove the temp session
    await db.deleteDocument('temp_session', session_id)

    ctx.response.body = {
      status: 200,
      session_id: session_id
    }
  } catch (err) {
    console.error(err)
    ctx.response.status = 500
    ctx.response.body = {
      status: 500,
      message: err.message
    }
  }
})

router.post('/api/session/join', async (ctx) => {
  const { value } = ctx.request.body({ type: 'json' })

  const payload = await value

  const session_id = payload.session_id
  const user_id    = payload.user_id

  if (!session_id || !user_id) {
    ctx.response.status = 400
    ctx.response.body = {
      status: 400,
      error: 'session_id or user_id missing from the payload'
    }
    return
  }

  try {
    const session = (await db.getDocument('session', session_id)) as unknown as sipapu.Session

    const temp = [user_id]
    
    const usersArray = temp.concat(session.users)

    await db.updateDocument('session', session_id, { users: usersArray })

    // add the user to the team
    const user = await users.get(user_id)
    await teams.createMembership(session_id, user.email, [], env.APPWRITE_ENDPOINT)

    ctx.response.body = {
      status: 200,
      message: 'Successfully joined session: ' + session_id
    }
  } catch (err) {
    ctx.response.status = 500
    ctx.response.body = {
      status: 500,
      error: err.message
    }
  }

})

export default router;
