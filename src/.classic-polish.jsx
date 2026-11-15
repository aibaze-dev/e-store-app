import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './styles.css';
import ClassicLanding from './templates/ClassicLanding.jsx';
import DownsellModal from './storefront/DownsellModal.jsx';
import { normalizeContent } from './templates/content.js';
const cover = 'https://7-dias-inteligencia-artificial.myshopify.com/cdn/shop/files/D11F403F-1D48-494E-B7CA-7F263C78C155_53db1ce7-1293-45ae-b4eb-5774678ee963.png?v=1785533695&width=1920';
const kit = 'https://7-dias-inteligencia-artificial.myshopify.com/cdn/shop/files/b92fc9f3-4925-40aa-9c68-7eb6f24e80e3Large.jpg?v=1785542972&width=1920';
const view = { subdomain: 'classic-polish-qa', store: { currency: 'USD', name: 'Domina Claude' }, template: 'classic',
 offer: { main: { name: 'Domina Claude en 7 días', price: 2700, compareAtPrice: 5400, coverUrl: cover }, bonuses: [{ productId:'b1', name: 'Prompts para tu profesión', referenceValue: 1900, coverUrl: cover },{ productId:'b2', name: 'Plantillas para empezar', referenceValue: 1500, coverUrl: kit }] },
 activity: {sales: 124, recent:[]}, downsell: { enabled: true },
 content: normalizeContent({ hero:{ eyebrow: 'DOMINA CLAUDE', title: 'Aprendé a usar Claude desde cero en 7 días y que se convierta en tu mejor aliado', subtitle:'Sin experiencia previa. A tu ritmo y con ejemplos prácticos.', secondaryImageUrl:kit, ctaText:'Quiero dominar Claude', note:'Un único pago. Acceso de por vida.' },
 promotion:{message:'OFERTA DE LANZAMIENTO · Bonos incluidos', remainingSpots:7},
 introduction:{enabled:true,title:'¿Y si tuvieras un asistente que te deja el trabajo hecho?',text:'Aprendé a darle contexto y transformá tus ideas en resultados. Una guía práctica para aplicar desde el primer día.'},
 painPoints:{title:'Tenés la IA más capaz y la usás como Google',items:[{title:'Respuestas genéricas',description:'Le pedís ayuda, pero no entiende lo que necesitás.'},{title:'Demasiadas tareas',description:'Repetís lo mismo y perdés tiempo cada día.'}]},
 benefits:{title:'El kit Domina Claude',items:[{title:'Guía paso a paso',description:'De cero a tu primer proyecto.',icon:'book'},{title:'Prompts profesionales',description:'Ejemplos listos para adaptar.',icon:'sparkles'}]},
 steps:{title:'7 días para pasar de chatear a delegar',items:['Dale contexto a Claude','Creá tu primer proyecto','Aplicalo en tu trabajo']},
 guarantee:{title:'Probalo 7 días sin riesgo',days:7,text:'Si no es para vos, podés solicitar el reembolso dentro de los primeros 7 días.'},
 faq:{items:[{question:'¿Necesito saber usar Claude?',answer:'No. Empezamos desde cero, con ejemplos prácticos.'},{question:'¿Cómo recibo el material?',answer:'Tenés acceso digital al confirmar tu compra.'}]},
 closing:{title:'Claude ya está listo para trabajar contigo.',ctaText:'Empezá hoy con Claude'},footer:{brandName:'Domina Claude — Vista local de prueba'} }) };
function Preview(){ const [clicks,setClicks]=useState(0); return <><ClassicLanding view={view} onCta={()=>setClicks(c=>c+1)}/><output style={{position:'fixed',right:8,top:44,fontSize:10,zIndex:80,background:'white',padding:4}}>Vista de prueba · Clics: {clicks}</output><DownsellModal view={view} step="landing" onAccept={()=>setClicks(c=>c+1)}/></> }
createRoot(document.getElementById('root')).render(<Preview/>);
