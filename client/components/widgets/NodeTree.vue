<template>
  <div class="node-tree bg-black bg-opacity-0 hover:bg-opacity-5" :style="{ paddingLeft: paddingLeft + 'px' }">
    <div class="node-tree-item flex items-center cursor-pointer" @click="clickNode">
      <span class="text-3xl node-icon" :class="iconClass">{{ icon }}</span>
      <p class="pl-2">{{ node.relativePath }}</p>
      <span v-if="hasContent" class="material-icons ml-2">arrow_drop_down</span>
      <span v-else-if="!node.isDirectory" class="font-mono ml-4 text-sm text-gray-400">{{ $bytesPretty(size) }}</span>
    </div>

    <div v-if="hasContent" :class="isOpen ? '' : 'h-0 overflow-hidden'">
      <div v-if="node.content && node.content.length">
        <node v-for="child in node.content" :key="child.id" ref="node" :node="child"></node>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'node',
  props: {
    node: Object
  },
  data() {
    return {
      isOpen: false,
      fileIcons: {
        audio: 'audiotrack',
        video: 'videocam',
        image: 'image',
        ebook: 'menu_book',
        text: 'description',
        info: 'description',
        opf: 'description',
        unknown: 'insert_drive_file'
      }
    }
  },
  computed: {
    paddingLeft() {
      return 20 * this.node.deep
    },
    iconClass() {
      if (this.node.isDirectory) {
        return 'material-icons text-yellow-400'
      }
      return 'material-icons-outlined text-white'
    },
    icon() {
      if (this.node.isDirectory) {
        return 'folder'
      }
      return this.fileIcons[this.node.fileType]
    },
    hasContent() {
      return this.node.isDirectory && this.node.content.length
    },
    size() {
      return this.node.stats.size
    }
  },
  methods: {
    clickNode() {
      if (this.node.isDirectory) {
        this.isOpen = !this.isOpen
      }
    },
    collapse() {
      if (!this.node.isDirectory) return

      this.isOpen = false
      var nodes = this.$refs.node || []
      nodes.forEach((node) => {
        if (node && node.collapse) node.collapse()
      })
    },
    expand() {
      if (!this.node.isDirectory) return

      this.isOpen = true
      var nodes = this.$refs.node || []
      nodes.forEach((node) => {
        if (node && node.expand) node.expand()
      })
    }
  }
}
</script>