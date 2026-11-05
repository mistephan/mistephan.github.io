const searchInput=document.querySelector('#article-search');
const cards=[...document.querySelectorAll('.card')];
const buttons=[...document.querySelectorAll('.filter')];
const count=document.querySelector('#result-count');
const empty=document.querySelector('#empty-state');
let active='全部';
function applyFilter(){
  const query=(searchInput.value||'').trim().toLocaleLowerCase();
  let shown=0;
  for(const card of cards){
    const matchCategory=active==='全部'||card.dataset.category===active;
    const matchText=!query||card.dataset.search.includes(query);
    card.hidden=!(matchCategory&&matchText);
    if(!card.hidden)shown++;
  }
  count.textContent=`显示 ${shown} / ${cards.length} 篇文章`;
  empty.style.display=shown?'none':'block';
}
searchInput?.addEventListener('input',applyFilter);
for(const button of buttons){button.addEventListener('click',()=>{active=button.dataset.category;for(const b of buttons){const isActive=b===button;b.classList.toggle('active',isActive);b.setAttribute('aria-pressed',String(isActive));}applyFilter();});}
applyFilter();
