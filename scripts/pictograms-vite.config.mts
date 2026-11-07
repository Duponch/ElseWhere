import {defineConfig} from 'vite';
export default defineConfig({cacheDir:'tmp/pictograms-vite-cache',build:{outDir:'tmp/pictograms-review-build',copyPublicDir:false,rolldownOptions:{input:'pictograms-review.html'}},server:{host:'127.0.0.1',port:5317,strictPort:true,watch:{ignored:['**/tmp/**']}},resolve:{alias:[{find:/^three$/,replacement:'three/webgpu'}]}});
