# Sprite atlas

Let's continue to keep all the atlases in one place

- Here I have already created 2 atlases .\www\data\atlas, it is clear from the folder itself how to use it.
- From this folder, the Resources class loads and generates atlases, for this, in the Resources class, you need to add the name of the atlas to the list approximately on line 96:
`for(let name of ['hotbar', 'bn']) {`
- In molds, you can get an already loaded and prepared atlas, like this:
`this.atlas = Resources.atlas.get('bn')`
- And you can set window background like this:
`this.setBackground(this.atlas.getSpriteFromMap('background'))`
- Atlases can be generated or updated at https://free-tex-packer.com/app/