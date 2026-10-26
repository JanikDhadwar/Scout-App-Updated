// Fixed-window limits stay independent of username changes and successful logins.
function createLimiter({maxKeys=10000,now=Date.now}={}){
 const buckets=new Map();
 return {take(key,maximum,windowMs=900000){
  const time=now();let bucket=buckets.get(key);
  if(!bucket||bucket.until<=time){
   for(const [id,value]of buckets)if(value.until<=time)buckets.delete(id);
   if(!buckets.has(key)&&buckets.size>=maxKeys)return false;
   bucket={count:0,until:time+windowMs};buckets.set(key,bucket);
  }
  if(bucket.count>=maximum)return false;bucket.count++;return true;
 }};
}
module.exports={createLimiter};
