import db from '@/datastore'

export default {
  namespaced: true,
  state: {
    list: [],
    selectedId: null
  },
  getters: {
    tags (state) {
      return state.list.map(i => {
        i.text = i.name
        return i
      })
    },
    selectedId (state) {
      return state.selectedId
    }
  },
  mutations: {
    SET_TAGS (state, tags) {
      state.list = tags
    },
    SET_SELECTED_ID (state, id) {
      state.selectedId = id
    }
  },
  actions: {
    getTags ({ commit }) {
      return new Promise((resolve, reject) => {
        db.tags
          .find({})
          .sort({ name: 1 })
          .exec((err, doc) => {
            if (err) reject(err)

            commit('SET_TAGS', doc)
            resolve(doc)
          })
      })
    },
    async addTag ({ dispatch }, tag) {
      return new Promise((resolve, reject) => {
        db.tags.findOne({ name: tag.name }, (err, doc) => {
          if (err) return

          if (!doc) {
            db.tags.insert(tag, (err, doc) => {
              if (err) reject(err)
              resolve(doc)
            })
            dispatch('getTags')
          } else {
            resolve(null)
          }
        })
      })
    },
    async addTagToSnippet ({ commit, rootGetters }, { tagId, snippetId }) {
      db.snippets.update({ _id: snippetId }, { $addToSet: { tags: tagId } })
    },
    removeTag ({ state, commit, dispatch, rootGetters }, id) {
      db.snippets.find({ tags: { $elemMatch: id } }, (err, doc) => {
        if (err) return
        // Collect IDs
        if (doc) {
          const ids = doc.reduce((acc, item) => {
            acc.push(item._id)
            return acc
          }, [])
          // Remove tag from all found snippets with this tag
          db.snippets.update(
            { _id: { $in: ids } },
            { $pull: { tags: id } },
            { multi: true },
            (err, doc) => {
              if (err) return
              // Delete the tag itself
              db.tags.remove({ _id: id }, async (err, doc) => {
                if (err) return
                // Get the updated tag list
                const tags = await dispatch('getTags')
                const firstTag = tags[0]
                // If there is a first tag, then set it as the selected one,
                // then get a list of snippets by tag
                if (firstTag) {
                  commit('SET_SELECTED_ID', firstTag._id)
                  await dispatch(
                    'snippets/getSnippets',
                    { tags: { $elemMatch: firstTag._id } },
                    { root: true }
                  )
                } else {
                  // If not, then switch to the library
                  dispatch('app/setShowTags', false, { root: true })
                }
              })
            }
          )
        }
      })
    }
  }
}
