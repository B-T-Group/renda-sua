export interface MapOrderPoint {
  id: string;
  orderNumber: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat?: number;
  deliveryLng?: number;
  commission?: number;
  currency: string;
  isExpress: boolean;
  pickupLabel: string;
  deliveryLabel: string;
}

export interface AvailableOrdersLeafletOptions {
  points: MapOrderPoint[];
  pickupColor: string;
  deliveryColor: string;
  highlightColor: string;
  userColor: string;
  lineColor: string;
  textColor: string;
  surfaceColor: string;
  pickupLabel: string;
  deliveryLabel: string;
  expressLabel: string;
  youLabel: string;
}

export function availableOrdersLeafletHtml(opts: AvailableOrdersLeafletOptions): string {
  const pointsJson = JSON.stringify(opts.points);
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#m{height:100%;width:100%;margin:0;padding:0}
body{background:${opts.surfaceColor}}
.leaflet-popup-content{margin:10px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:${opts.textColor}}
.popup-title{font-weight:800;margin-bottom:4px}
.popup-row{font-size:12px;line-height:16px}
.badge{display:inline-block;margin-left:6px;padding:1px 5px;border-radius:999px;background:${opts.surfaceColor};color:${opts.pickupColor};font-size:10px;font-weight:700}
</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var points=${pointsJson};
var pickupColor=${JSON.stringify(opts.pickupColor)};
var deliveryColor=${JSON.stringify(opts.deliveryColor)};
var highlightColor=${JSON.stringify(opts.highlightColor)};
var userColor=${JSON.stringify(opts.userColor)};
var lineColor=${JSON.stringify(opts.lineColor)};
var pickupLabel=${JSON.stringify(opts.pickupLabel)};
var deliveryLabel=${JSON.stringify(opts.deliveryLabel)};
var expressLabel=${JSON.stringify(opts.expressLabel)};
var youLabel=${JSON.stringify(opts.youLabel)};
var map=L.map('m',{zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var markersById={};
var userMarker=null;
var selectedId=null;
var bounds=[];
function postOrder(id){
  var payload=JSON.stringify({type:'select-order',orderId:id});
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(payload);}
  else if(window.parent){window.parent.postMessage(payload,'*');}
}
function esc(value){
  return String(value||'').replace(/[&<>"']/g,function(char){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
  });
}
function stylePickup(marker,selected){
  marker.setStyle({
    radius:selected?14:10,
    color:'#fff',
    weight:selected?4:3,
    fillColor:selected?highlightColor:pickupColor,
    fillOpacity:1
  });
}
function focusOrder(id,options){
  options=options||{};
  var entry=markersById[id];
  if(!entry) return;
  if(selectedId && markersById[selectedId]) stylePickup(markersById[selectedId].pickup,false);
  selectedId=id;
  stylePickup(entry.pickup,true);
  if(entry.delivery){
    map.fitBounds(L.latLngBounds([entry.pickup.getLatLng(),entry.delivery.getLatLng()]),{padding:[56,56],maxZoom:15});
  } else {
    map.setView(entry.pickup.getLatLng(),15,{animate:true});
  }
  entry.pickup.openPopup();
  if(!options.silent) postOrder(id);
}
function setUserLocation(lat,lng,center){
  var ll=[lat,lng];
  if(userMarker){userMarker.setLatLng(ll);}
  else {
    userMarker=L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:userColor,fillOpacity:1})
      .addTo(map).bindPopup(esc(youLabel));
  }
  if(center) map.setView(ll,15,{animate:true});
}
function centerOnUser(){
  if(!userMarker) return;
  map.setView(userMarker.getLatLng(),15,{animate:true});
  userMarker.openPopup();
}
function handleCommand(raw){
  try{
    var data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data||!data.type) return;
    if(data.type==='focus-order' && data.orderId) focusOrder(data.orderId,{silent:true});
    if(data.type==='set-user-location' && data.lat!=null && data.lng!=null){
      setUserLocation(Number(data.lat),Number(data.lng),!!data.center);
    }
    if(data.type==='center-on-user') centerOnUser();
  }catch(e){}
}
window.addEventListener('message',function(event){handleCommand(event.data);});
document.addEventListener('message',function(event){handleCommand(event.data);});
points.forEach(function(point){
  var pickup=[point.pickupLat,point.pickupLng];
  bounds.push(pickup);
  var popup='<div class="popup-title">#'+esc(point.orderNumber)+(point.isExpress?'<span class="badge">'+esc(expressLabel)+'</span>':'')+'</div>'
    +'<div class="popup-row">'+esc(pickupLabel)+': '+esc(point.pickupLabel)+'</div>'
    +'<div class="popup-row">'+esc(deliveryLabel)+': '+esc(point.deliveryLabel)+'</div>'
    +(point.commission!=null?'<div class="popup-row"><strong>'+esc(point.currency)+' '+Number(point.commission).toFixed(0)+'</strong></div>':'');
  var pickupMarker=L.circleMarker(pickup,{radius:10,color:'#fff',weight:3,fillColor:pickupColor,fillOpacity:1})
    .addTo(map).bindPopup(popup)
    .on('click',function(){focusOrder(point.id);});
  var deliveryMarker=null;
  if(point.deliveryLat!=null && point.deliveryLng!=null){
    var delivery=[point.deliveryLat,point.deliveryLng];
    bounds.push(delivery);
    deliveryMarker=L.circleMarker(delivery,{radius:6,color:'#fff',weight:2,fillColor:deliveryColor,fillOpacity:1})
      .addTo(map).bindPopup(esc(deliveryLabel)+': '+esc(point.deliveryLabel));
    L.polyline([pickup,delivery],{color:lineColor,weight:3,opacity:0.55,dashArray:'6,8'}).addTo(map);
  }
  markersById[point.id]={pickup:pickupMarker,delivery:deliveryMarker};
});
if(bounds.length>1){map.fitBounds(L.latLngBounds(bounds),{padding:[48,48],maxZoom:14});}
else if(bounds.length===1){map.setView(bounds[0],14);}
window.__orderMap={focusOrder:focusOrder,setUserLocation:setUserLocation,centerOnUser:centerOnUser};
</script></body></html>`;
}
