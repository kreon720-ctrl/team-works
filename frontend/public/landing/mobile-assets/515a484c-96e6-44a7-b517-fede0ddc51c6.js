/* ============================================================
   TEAM WORKS — Mobile interactions
   ============================================================ */
(function(){
  "use strict";
  var $  = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* ---------- hamburger menu ---------- */
  var burger = $("#burger");
  var menu = $("#menu");
  function closeMenu(){ document.body.classList.remove("menu-open"); if(burger) burger.setAttribute("aria-expanded","false"); }
  function toggleMenu(){
    var open = document.body.classList.toggle("menu-open");
    if(burger) burger.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if(burger){ burger.addEventListener("click", toggleMenu); }
  if(menu){ $$("a", menu).forEach(function(a){ a.addEventListener("click", closeMenu); }); }

  /* ---------- TOC jump ---------- */
  $$(".toc__item").forEach(function(btn){
    btn.addEventListener("click", function(){
      var t = $(btn.dataset.go);
      if(t){ window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 60, behavior:"smooth" }); }
    });
  });

  /* ---------- reveal on scroll ---------- */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function revealInView(){
    var vh = window.innerHeight || 800;
    $$(".reveal").forEach(function(e){
      if(e.classList.contains("in")) return;
      var r = e.getBoundingClientRect();
      if(r.top < vh * 0.92 && r.bottom > 0){ e.classList.add("in"); }
    });
  }
  if(reduce){
    $$(".reveal").forEach(function(e){ e.classList.add("in"); });
  } else if("IntersectionObserver" in window){
    var io = new IntersectionObserver(function(ents){
      ents.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach(function(e){ io.observe(e); });
    /* failsafe: reveal whatever is already on screen, even if IO is throttled */
    revealInView();
    window.addEventListener("load", revealInView);
    setTimeout(revealInView, 800);
  } else {
    $$(".reveal").forEach(function(e){ e.classList.add("in"); });
  }

  /* ---------- looping URL typewriter ---------- */
  function typeLoop(el){
    if(!el) return;
    var full = el.dataset.text || el.textContent || "";
    if(reduce){ el.textContent = full; return; }
    var caret = '<span class="caret"></span>';
    var i = 0, dir = 1, timer = null, running = false;
    function tick(){
      el.innerHTML = full.slice(0, i) + caret;
      if(dir === 1){
        if(i < full.length){ i++; timer = setTimeout(tick, 75); }
        else { timer = setTimeout(function(){ dir = -1; tick(); }, 1500); }
      } else {
        if(i > 0){ i--; timer = setTimeout(tick, 40); }
        else { timer = setTimeout(function(){ dir = 1; tick(); }, 520); }
      }
    }
    function start(){ if(running) return; running = true; tick(); }
    function stop(){ running = false; if(timer){ clearTimeout(timer); timer = null; } }
    if("IntersectionObserver" in window){
      var io2 = new IntersectionObserver(function(ents){
        ents.forEach(function(e){ if(e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.4 });
      io2.observe(el);
    } else { start(); }
  }
  typeLoop($("#typeUrlTop"));
  typeLoop($("#typeUrlBottom"));

  /* ---------- hero cycle stage ---------- */
  (function heroCycle(){
    var stage = $("#mstage");
    if(!stage) return;
    var layers = {};
    $$(".mlayer", stage).forEach(function(l){ layers[l.dataset.k] = l; });

    /* size stage to tallest layer */
    function sizeStage(){
      stage.style.height = "auto";
      var max = 0;
      $$(".mlayer", stage).forEach(function(l){
        var pos=l.style.position, op=l.style.opacity, vis=l.style.visibility, disp=l.style.display;
        l.style.position="static"; l.style.opacity="0"; l.style.visibility="hidden"; l.style.display="flex";
        max = Math.max(max, l.offsetHeight);
        l.style.position=pos; l.style.opacity=op; l.style.visibility=vis; l.style.display=disp;
      });
      stage.style.height = max + "px";
    }
    sizeStage();
    window.addEventListener("load", sizeStage);
    var rt; window.addEventListener("resize", function(){ clearTimeout(rt); rt=setTimeout(sizeStage, 200); }, { passive:true });

    /* brand-url typewriter (loops while brand layer is shown) */
    var brandTimer=null, brandRunning=false;
    function brandTypeStart(){
      var el=$("#mTypeUrl"); if(!el) return;
      var full=el.dataset.text||el.textContent||"";
      if(reduce){ el.textContent=full; return; }
      if(brandRunning) return; brandRunning=true;
      var caret='<span class="caret"></span>', i=0, dir=1;
      function tick(){
        el.innerHTML=full.slice(0,i)+caret;
        if(dir===1){ if(i<full.length){ i++; brandTimer=setTimeout(tick,75);} else { brandTimer=setTimeout(function(){dir=-1;tick();},1300);} }
        else { if(i>0){ i--; brandTimer=setTimeout(tick,40);} else { brandTimer=setTimeout(function(){dir=1;tick();},460);} }
      }
      tick();
    }
    function brandTypeStop(){ brandRunning=false; if(brandTimer){ clearTimeout(brandTimer); brandTimer=null; } }

    /* sequence: key, fade(ms, used for both in & out), hold(ms) */
    var steps = [
      { k:"painMedia", fade:600,  hold:3000 },
      { k:"painList",  fade:600,  hold:10000 },
      { k:"punch1",    fade:1500, hold:3000 },
      { k:"punch2",    fade:1500, hold:3000 },
      { k:"heroMsg",   fade:600,  hold:15000 },
      { k:"brand",     fade:600,  hold:7000, onShow:brandTypeStart, onHide:brandTypeStop }
    ];

    if(reduce){
      Object.keys(layers).forEach(function(k){ layers[k].classList.remove("is-active"); });
      layers.heroMsg.classList.add("is-active");
      return;
    }

    var t1=null, t2=null, running=false;
    function play(i){
      var s = steps[i];
      var el = layers[s.k];
      el.classList.add("is-active");
      if(s.onShow) s.onShow();
      t1 = setTimeout(function(){
        el.classList.remove("is-active");
        if(s.onHide) s.onHide();
        t2 = setTimeout(function(){ play((i+1) % steps.length); }, s.fade);
      }, s.fade + s.hold);
    }
    function start(){ if(running) return; running=true; play(0); }

    if("IntersectionObserver" in window){
      var io3 = new IntersectionObserver(function(ents){
        ents.forEach(function(e){ if(e.isIntersecting){ io3.disconnect(); start(); } });
      }, { threshold: 0.25 });
      io3.observe(stage);
      setTimeout(start, 2200); /* failsafe */
    } else { start(); }
  })();

})();
