export const categories = [
  { id: "run-without-you", title: "Build a Business That Runs Without You", description: "Turn founder-held knowledge and relationships into organizational capability." },
  { id: "executive-visibility", title: "See What Is Happening in Your Business", description: "Make performance, risk, and decisions visible without assembling the truth manually." },
  { id: "operational-friction", title: "Eliminate Operational Friction", description: "Clarify workflows before applying practical automation and AI." },
] as const;
export const resources = [
  { slug:"business-that-lives-in-your-head", category:"run-without-you", type:"Video · 8 min", title:"The Business That Lives in Your Head", summary:"Why undocumented operating knowledge makes a company fragile, and how to begin converting experience into repeatable capability.", action:"Write down one critical process and hand it to someone else." },
  { slug:"one-big-client-risk", category:"run-without-you", type:"Video · 9 min", title:"Why One Big Client Can Destroy Your Sale", summary:"A practical look at customer concentration, revenue predictability, and the hidden dependencies buyers notice immediately.", action:"Calculate the share of revenue controlled by your three largest customers.", youtubeUrl:"https://www.youtube.com/watch?v=L3MV7h-zzOI", youtubeEmbedUrl:"https://www.youtube.com/embed/L3MV7h-zzOI" },
  { slug:"executive-reports-that-drive-action", category:"executive-visibility", type:"Guide · 6 min", title:"Why Executive Reports Fail to Drive Action", summary:"Separate useful operating signals from management noise and redesign reporting around decisions rather than historical explanation.", action:"Name the decision each recurring report is supposed to improve." },
  { slug:"automation-before-ai", category:"operational-friction", type:"Article · 7 min", title:"Do Not Automate a Process You Do Not Understand", summary:"Why automation magnifies unclear ownership and process variation, and what to do before selecting a tool.", action:"Map the handoffs and exceptions before selecting a tool." },
] as const;
