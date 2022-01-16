<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden relative" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full h-full p-8 overflow-y-auto">
      <h1 class="text-2xl mb-4">
        Manage Files for <span class="font-semibold">{{ audiobook.book.title }}</span>
      </h1>
      <p class="text-base mb-4 font-mono"><span class="uppercase text-xs text-gray-300 font-sans">Audiobook Path</span><br />{{ audiobook.fullPath }}</p>

      <!-- <template v-for="file in filetree"> -->
      <widgets-node-tree ref="nodeTree" :node="filetree" @ready="ready" />
      <!-- </template> -->
      <!-- <table class="text-sm tracksTable">
        <tr class="font-book">
          <th class="text-left px-4">Relative Path</th>
          <th class="text-left px-4 w-24">Filetype</th>
          <th v-if="userCanDownload" class="text-center w-20">Download</th>
        </tr>
        <template v-for="file in allFiles">
          <tr :key="file.path">
            <td class="font-book pl-2">
              {{ file.relativePath }}
            </td>
            <td class="text-xs">
              <p>{{ file.filetype }}</p>
            </td>
            <td class="text-center">
              <div class="flex items-center">
                <button class="focus:outline-none focus:bg-gray-500 focus:bg-opacity-20 bg-transparent border-0 hover:bg-gray-400 hover:bg-opacity-20 uppercase rounded-sm px-2 py-1 mx-2">Rename</button>
                <a :href="`/s/book/${audiobookId}/${file.relativePath}?token=${userToken}`" download><span class="material-icons icon-text mt-1.5">download</span></a>
              </div>
            </td>
          </tr>
        </template>
      </table> -->
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    if (!store.getters['user/getIsRoot']) {
      return redirect('/?error=unauthorized')
    }
    var audiobook = await app.$axios.$get(`/api/books/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!audiobook) {
      console.error('No audiobook...', params.id)
      return redirect('/')
    }
    var filetree = await app.$axios.$get(`/api/books/${params.id}/files`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    return {
      audiobook,
      filetree
    }
  },
  data() {
    return {}
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    audiobookId() {
      return this.audiobook.id
    },
    audiobookPath() {
      return this.audiobook.path.replace(/\\/g, '/')
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    audioFiles() {
      return (this.audiobook.audioFiles || []).map((af) => {
        return {
          ...af,
          filetype: 'audio'
        }
      })
    },
    otherFiles() {
      return this.audiobook.otherFiles || []
    },
    allFiles() {
      return [...this.audioFiles, ...this.otherFiles].map((file) => {
        return {
          ...file,
          relativePath: this.getRelativePath(file.path)
        }
      })
    }
  },
  methods: {
    ready() {
      if (this.$refs.nodeTree) {
        this.$refs.nodeTree.expandPath(this.audiobookPath)
      }
    },
    getRelativePath(path) {
      var filePath = path.replace(/\\/g, '/')
      var audiobookPath = this.audiobookPath
      return filePath
        .replace(audiobookPath + '/', '')
        .replace(/%/g, '%25')
        .replace(/#/g, '%23')
    }
  },
  mounted() {
    console.log(this.filetree)
  }
}
</script>