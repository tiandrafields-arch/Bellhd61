/* District Atlas. Geographic assets and Leaflet are served from this Site. */
(() => {
  "use strict";
  const files = new URL("cartography/", document.currentScript?.src || document.baseURI);
  const asset = name => window.BellOffline?.assets[name] || new URL(name, files).href;
  const fmt = value => Number(value).toLocaleString("en-US");
  const pct = (part, total) => total ? (100 * part / total).toFixed(1) + "%" : "Unavailable";
  const norm = p => p.house && p.council ? "House and council overlap" : p.house ? "House District 61 only" : "Council District 7 only";
  const values = {
    registration: {name:"Registered voters", key:[["Below 800","#d5e5ee"],["800 to 1,199","#9ebfd4"],["1,200 or more","#598bae"]],color:p=>p.registered>=1200?"#598bae":p.registered>=800?"#9ebfd4":"#d5e5ee"},
    overlap: {name:"Council overlap", key:[["House only","#bcd4e4"],["Both districts","#486f98"],["Council only","#d7b9bd"]],color:p=>p.house&&p.council?"#486f98":p.house?"#bcd4e4":"#d7b9bd"},
    bell: {name:"Bell vote share",key:[["Below 40%","#c5d9e5"],["40% to under 50%","#8bb0c9"],["50% or more","#486f98"],["Outside council","#e8ebed"]],color:p=>p.bell==null?"#e8ebed":p.bell/(p.bell+p.harris)>=.5?"#486f98":p.bell/(p.bell+p.harris)>=.4?"#8bb0c9":"#c5d9e5"}
  };
  for(const [id,year] of [["turnout26","2026"],["turnout24","2024"]]){
    values[id]={name:year+" November turnout",key:[["Below 40%","#d5e5ee"],["40% to under 55%","#9ebfd4"],["55% or more","#598bae"]],color:p=>p[id].turnoutPct>=55?"#598bae":p[id].turnoutPct>=40?"#9ebfd4":"#d5e5ee"};
  }
  values.repeat = {
    name: 'Voted in at least 2 of 3 elections',
    key: [['Below 200','#d5e5ee'],['200 to 299','#9ebfd4'],['300 or more','#598bae']],
    color(p) {
      const tiers = DATA.voterFile.areas[p.id];
      const count = tiers[2] + tiers[3];
      return count >= 300 ? '#598bae' : count >= 200 ? '#9ebfd4' : '#d5e5ee';
    }
  };
  const usesCouncil=mode=>mode==="overlap"||mode==="bell";
  const isTurnout=mode=>mode==="turnout24"||mode==="turnout26";
  const icons = {
    plus:'<path d="M12 5v14m-7-7h14"/>',minus:'<path d="M5 12h14"/>',
    reset:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>'
  };
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text!==undefined) el.textContent = text;
    return el;
  };
  const option = (sel,value,label) => sel.add(new Option(label,value));
  const link = (text,url) => {const a=node("a",null,text);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
  let dependencies;
  function loadDependencies(){
    if (window.BellOffline) {
      return Promise.resolve([window.L, window.BellOffline.geography, window.BellOffline.places]);
    }
    if (!dependencies) {
      let loadLeaflet=window.L ? Promise.resolve() : new Promise((resolve,reject)=>{
        const script=node("script");script.src=asset("leaflet.js");script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      const read = name => fetch(asset(name)).then(r=>{if(!r.ok)throw Error(name);return r.json()});
      dependencies=Promise.all([loadLeaflet,read("geodata.json"),read("place_labels.json")]).catch(error=>{dependencies=null;throw error});
    }
    return dependencies;
  }
  const registries=new WeakMap();
  window.mountAtlas=function(container, options={}){
    if(typeof container==="string")container=document.querySelector(container);
    if(!container)return;
    const old=registries.get(container);
    if(old){old.refresh();return old}
    let map=null, cancelled=false, resize=null;
    container.classList.add("campaign-atlas");
    container.classList.toggle("is-compact",Boolean(options.compact));
    container.replaceChildren(node("div","at-loading","Loading district map…"));
    const control={refresh(){if(map)requestAnimationFrame(()=>map?.invalidateSize({pan:false}))},destroy(){cancelled=true;resize?.disconnect();if(map)map.remove();map=null;registries.delete(container)}};
    registries.set(container,control);
    control.ready=loadDependencies().then(([,geography,places])=>{
      if(cancelled)return;
      const L=window.L, compact=Boolean(options.compact);
      const tools=node("div","at-tools");
      const stage=node("div","at-stage"),canvas=node("div","at-canvas");
      canvas.setAttribute("aria-label","Baton Rouge district map. Use the precinct menu to inspect any area.");
      const key=node("div","at-mapkey");key.setAttribute("aria-label","Map legend");
      const corner=node("div","at-quick-layer"),buttons=node("div","at-map-buttons");
      stage.append(canvas,corner,buttons,key);
      const summary=node("div","at-summary");summary.setAttribute("aria-live","polite");
      const scope=node("p"),toolSelect=node("select"),compactSelect=node("select"),title=node("h4"),amounts=node("div","at-values");
      const aside=node("div");
      if(compact){compactSelect.setAttribute("aria-label","Inspect a precinct");compactSelect.style.maxWidth="240px";aside.append(compactSelect,scope)}
      else aside.append(title,scope);
      summary.append(aside,amounts);
      const foot=node("div","at-mapfoot");
      let selected=null,mode=options.mode&&values[options.mode]?options.mode:"registration",drawn=null,edge=null;
      const visibleFeatures=()=>geography.precincts.features.filter(f=>usesCouncil(mode) || f.properties.house);
      const titleLayer=node("label","at-field","Map layer"),titlePrec=node("label","at-field","Inspect precinct");
      titlePrec.append(toolSelect);tools.append(titleLayer,titlePrec);
      const layerSelect=node("select"),quickSelect=node("select");
      for (const sel of [layerSelect,quickSelect]) {
        sel.setAttribute("aria-label","Map layer");Object.entries(values).forEach(([id,v])=>option(sel,id,v.name));sel.value=mode;
        sel.onchange=()=>changeMode(sel.value);
      }
      titleLayer.append(layerSelect);corner.append(quickSelect);
      container.replaceChildren(tools,stage,summary,foot);
      map=L.map(canvas,{zoomControl:false,attributionControl:false,scrollWheelZoom:false,zoomSnap:.05,zoomDelta:.5,preferCanvas:true,minZoom:11,maxZoom:16,zoomAnimation:false,fadeAnimation:false,maxBounds:[[30.355,-91.25],[30.55,-91.012]],maxBoundsViscosity:.82});
      const attrib=L.control.attribution({prefix:false,position:"bottomright"}).addTo(map);
      attrib.addAttribution('<a href="https://gis.brla.gov/" target="_blank" rel="noopener">EBRGIS</a> · <a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
      L.control.scale({metric:false,imperial:true,position:"bottomleft",maxWidth:66}).addTo(map);
      const basemapBounds=[[30.36,-91.25],[30.55,-91.01]];
      L.imageOverlay(asset("baton_rouge.svg"),basemapBounds,{pane:"tilePane",interactive:false,opacity:1}).addTo(map);
      for (const [name,z] of [["atLabels",470],["atEdges",460]]) {let pane=map.createPane(name);pane.style.zIndex=z;pane.style.pointerEvents="none"}
      const house=L.geoJSON(geography.house).getBounds(),union=house.extend?L.latLngBounds(house.getSouthWest(),house.getNorthEast()).extend(L.geoJSON(geography.council).getBounds()):house;
      const labels=L.layerGroup().addTo(map);
      const btn=(icon,tip,fn)=>{
        const b=node("button");b.type="button";b.title=tip;b.setAttribute("aria-label",tip);
        b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[icon]+'</svg>';b.onclick=fn;buttons.append(b);return b;
      };
      const inc=btn("plus","Zoom in",()=>map.zoomIn(.6));const dec=btn("minus","Zoom out",()=>map.zoomOut(.6));btn("reset","Reset map view",()=>{selectArea(null);fit()});
      function fit(){const bounds=usesCouncil(mode)?union:house;map.invalidateSize({pan:false});map.fitBounds(bounds,{paddingTopLeft:compact?[32,43]:[46,28],paddingBottomRight:compact?[40,47]:[49,55],animate:false,maxZoom:14.35})}
      function fillList(){
        for(const sel of [toolSelect,compactSelect]){
          sel.replaceChildren();option(sel,"","Select a precinct");
          visibleFeatures().forEach(f=>option(sel,f.properties.id,'Precinct '+f.properties.id));
          sel.value=selected||"";sel.onchange=()=>selectArea(sel.value||null,true);
        }
      }
      function style(f,hover=false){
        const p=f.properties,active=p.id===selected;
        return {color:active?"#9b3545":hover?"#843a49":"#70899e",weight:active?3:hover?2.2:.85,opacity:active?1:.86,fillColor:values[mode].color(p),fillOpacity:active?.76:mode==="overlap"?.60:mode==="bell"?.57:.53,lineJoin:"round"};
      }
      const renderer=L.canvas({padding:.3}),edgeRenderer=L.svg({pane:"atEdges",padding:.3});
      function draw(){
        if(drawn)drawn.remove();
        if(edge)edge.remove();
        drawn=L.geoJSON({type:"FeatureCollection",features:visibleFeatures()},{
          renderer,style:f=>style(f),
          onEachFeature(f,layer){
            const p=f.properties;
            layer.bindTooltip("Precinct "+p.id,{sticky:true,direction:"top",offset:[0,-7]});
            layer.on("click",()=>selectArea(p.id));
            layer.on("mouseover",()=>layer.setStyle(style(f,true)));
            layer.on("mouseout",()=>layer.setStyle(style(f)));
          }
        }).addTo(map);
        edge=L.layerGroup().addTo(map);
        if(usesCouncil(mode)){
          L.geoJSON(geography.council,{renderer:edgeRenderer,interactive:false,style:{fill:false,weight:2.15,color:"#9c5361",opacity:.94,dashArray:"5 4",lineJoin:"round"}}).addTo(edge);
        }
        L.geoJSON(geography.house,{renderer:edgeRenderer,interactive:false,style:{fill:false,weight:2.6,color:"#244b6b",opacity:1,lineJoin:"round"}}).addTo(edge);
      }
      function detail(){
        const p=selected&&visibleFeatures().find(f=>f.properties.id===selected)?.properties;
        title.textContent=p?'Precinct '+p.id:'District 61';
        scope.textContent=p?norm(p):(mode==="registration"?"House District 61":mode==="overlap"?"House District 61 and Metro Council District 7":"2024 Metro Council District 7 results");
        let metrics=p?[["Registered",fmt(p.registered)],["Democratic",fmt(p.dem)],["Republican",fmt(p.rep)],["Other affiliation",fmt(p.other)]]:
          mode==="registration"?[["Registered",fmt(geography.summary.registration.registered)],["Mapped areas",String(geography.summary.units)]]:
          mode==="overlap"?[["Shared areas",String(geography.summary.overlapUnits)],["House registration in overlap",pct(geography.summary.overlap.registered,geography.summary.registration.registered)]]:
          [["Bell votes in overlap",fmt(geography.summary.overlap.bell)],["Bell share in overlap",pct(geography.summary.overlap.bell,geography.summary.overlap.bell+geography.summary.overlap.harris)]];
        if(p&&mode==="bell") metrics=p.bell==null?[["Council result","Outside district"]]:[["Bell",fmt(p.bell)],["Harris",fmt(p.harris)],["Bell share",pct(p.bell,p.bell+p.harris)]];
        if(isTurnout(mode)){
          const t=p?p[mode]:geography.summary[mode];
          metrics=[["Turnout",t.turnoutPct.toFixed(1)+"%"],["Voted",fmt(t.voted)],["Registered on election date",fmt(t.registered)]];
          if(!p)scope.textContent=mode==="turnout26"?"November 2026 federal midterm":"November 2024 presidential election";
        }
        if(mode === 'repeat'){
          const tiers = p ? DATA.voterFile.areas[p.id] : DATA.voterFile.tiers;
          scope.textContent = 'Active file · Nov 23, 2026';
          metrics = [['Voted in at least 2 of 3',fmt(tiers[2]+tiers[3])],['Voted in all 3',fmt(tiers[3])],['Active voters',fmt(tiers.reduce((a,b)=>a+b,0))]];
        }
        if(p&&compact&&mode!=="bell"&&!isTurnout(mode))metrics=[metrics[0]];
        if(compact&&isTurnout(mode))metrics=metrics.slice(0,2);
        if(compact&&!p&&mode==="registration")metrics=[["Registered",fmt(geography.summary.registration.registered)]];
        amounts.replaceChildren(...metrics.map(([label,value])=>{const s=node("span",null,label),b=node("b",null,value);s.append(b);return s}));
      }
      function selectArea(id,pan=false){
        selected=id;
        toolSelect.value=id||"";compactSelect.value=id||"";
        drawn.eachLayer(layer=>{
          layer.setStyle(style(layer.feature));
          if(id===layer.feature.properties.id){layer.bringToFront();if(pan){const bounds=layer.getBounds();if(!map.getBounds().contains(bounds))map.panInsideBounds(bounds,{padding:[32,32],animate:false})}}
        });
        detail();labelMap();
      }
      function reference(){
        const election=mode==="bell";
        foot.replaceChildren();
        if(mode === 'repeat'){
          foot.append('Active voters who cast a ballot in at least two of the three elections we reviewed. November 23, 2026 file. ');
          const methodology = node('a',null,'Dates and methods');
          methodology.href = '#voterfile';
          foot.append(methodology);
          return;
        }
        if(isTurnout(mode)){
          foot.append(mode==="turnout26"?"November 3, 2026. ":"November 5, 2024. ","Participation by home precinct, all voting methods. ",link("Secretary of State turnout",geography.sources[mode]));return;
        }
        foot.append(election?"Election Day votes only. Early and absentee ballots are reported together across the council contest. ":"Registration as of November 1, 2026. ");
        if(mode==="overlap")foot.append("Council boundaries and precincts shown for geographic comparison. ");
        foot.append(link(election?"Precinct results":"Registration source",election?geography.sources.precinctVotes:geography.sources.registration)," · ",link("Adopted House map",geography.sources.enactedMap));
      }
      function changeMode(next){
        mode=next;selected=null;layerSelect.value=mode;quickSelect.value=mode;
        key.replaceChildren(...values[mode].key.map(([label,color])=>{const s=node("span","at-keypart");const sw=node("i","at-swatch");sw.style.background=color;s.append(sw,label);return s}));
        fillList();draw();detail();reference();fit();labelMap();
      }
      function labelMap(){
        if(!map||!map._loaded)return;
        labels.clearLayers();
        inc.disabled=map.getZoom()>=map.getMaxZoom()-.01;dec.disabled=map.getZoom()<=map.getMinZoom()+.01;
        const size=map.getSize(),z=map.getZoom(),avoid=[];
        function put(text,lat,lon,cls,forced=false){
          const v=map.latLngToContainerPoint([lat,lon]),tw=cls==="prec"?32:Math.max(text.length*(cls==="area"?6.8:5.4),45);
          const rect=[v.x-tw/2,v.y-9,v.x+tw/2,v.y+9];
          if(rect[0]<8||rect[2]>size.x-8||v.y<20||v.y>size.y-38)return;
          if(compact&&v.x<166&&v.y<46 || v.x>size.x-56&&v.y<120)return;
          if(!forced&&avoid.some(a=>a[0]<rect[2]+8&&a[2]>rect[0]-8&&a[1]<rect[3]+7&&a[3]>rect[1]-7))return;
          avoid.push(rect);
          const t=node("span",null,text);
          L.marker([lat,lon],{pane:"atLabels",keyboard:false,interactive:false,icon:L.divIcon({className:'at-label '+cls,html:t.outerHTML,iconSize:[0,0],iconAnchor:[0,0]})}).addTo(labels);
        }
        if(z>=14.15){
          visibleFeatures().forEach(f=>{const p=f.properties;put(p.id,p.center[1],p.center[0],"prec")});
        } else if(selected){
          const hit=visibleFeatures().find(f=>f.properties.id===selected)?.properties;if(hit)put(hit.id,hit.center[1],hit.center[0],"prec",true);
        }
        let ordered=[...places].sort((a,b)=>{const first=["Mid City","Goodwood","Brookstown","Downtown East","Eden Park","Broadmoor"];let ai=first.indexOf(a[0]),bi=first.indexOf(b[0]);return (ai<0?10:ai)-(bi<0?10:bi)});
        ordered.forEach(([name,lat,lon,kind])=>{if(kind!=="road"||z>=13.45)put(name,lat,lon,kind)});
      }
      map.on("zoomend moveend resize",labelMap);
      changeMode(mode);
      let wasVisible=canvas.offsetWidth>0;
      if(typeof ResizeObserver!=="undefined"){
        resize=new ResizeObserver(()=>{const visible=canvas.offsetWidth>0;if(visible){map.invalidateSize({pan:false});if(!wasVisible)fit();labelMap()}wasVisible=visible});
        resize.observe(canvas);
      }
      control.map=map;control.setMode=changeMode;control.select=selectArea;
      return control;
    }).catch(()=>{if(!cancelled){container.replaceChildren(node("div","at-loading","The district map could not load."));const retry=node("button",null,"Retry map");retry.type="button";retry.onclick=()=>{control.destroy();window.mountAtlas(container,options)};container.append(retry)}});
    return control;
  };
})();
