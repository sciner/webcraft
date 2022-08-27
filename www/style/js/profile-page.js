function initProfilePage(skin_index) {

    var skinsCurrent = document.querySelector('#skins-current');
    var skinsLength = document.querySelector('#skins-length');
    var buttonPrev = document.querySelector('#slider-prev');
    var buttonNext = document.querySelector('#slider-next');
    // var index;

    const slider = new KeenSlider("#skins-slider", {
        initial: skin_index,
        detailsChanged: (s) => {
            const slides = s.track.details.slides
            s.slides.forEach((element, idx) => {
                scaleElement(element.querySelector("div"), slides[idx].portion)
            })
        },
    });

    function scaleElement(element, portion) {
        var scale_size = 0.7
        var scale = 1 - (scale_size - scale_size * portion)
        var style = `scale(${scale})`;
        element.style.transform = style;
        element.style["-webkit-transform"] = style;
    }

    const thumbnails = new KeenSlider(
        "#skins-preview-slider",
        {
            initial: skin_index,
            slides: {
                perView: 4,
                spacing: 16,
            },
            breakpoints: {
                "(min-width: 0px)": {
                    slides: { perView: 2, spacing: 16 },
                },
                "(min-width: 500px)": {
                    slides: { perView: 3, spacing: 16 },
                },
                "(min-width: 600px)": {
                    slides: { perView: 4, spacing: 16 },
                },
                
                
            },
        },
        [ThumbnailPlugin(slider)]
    );

    function ThumbnailPlugin(main) {
        return (slider) => {
            function removeActive() {
                slider.slides.forEach((slide) => {
                    slide.classList.remove("active")
                })
            }
            function addActive(idx) {
                slider.slides[idx].classList.add("active")
                skinsCurrent.innerHTML = idx + 1; //set skinsCurrent value
                if (idx == 0) {
                    buttonPrev.classList.add('disabled');
                }
                if (idx != 0) {
                    buttonPrev.classList.remove('disabled');
                }
                if (idx == slider.slides.length - 1) {
                    buttonNext.classList.add('disabled');
                }
                if (idx != slider.slides.length - 1) {
                    buttonNext.classList.remove('disabled');
                }
            }
            function addClickEvents() {
                slider.slides.forEach((slide, idx) => {
                    slide.addEventListener("click", () => {
                        main.moveToIdx(idx)
                    })
                })
            }
            slider.on("created", () => {
                addActive(slider.track.details.rel)
                addClickEvents()
                main.on("animationStarted", (main) => {
                    removeActive()
                    const next = main.animator.targetIdx || 0
                    addActive(main.track.absToRel(next))
                    slider.moveToIdx(next)
                })
            })
        }
    };

    skinsLength.innerHTML = slider.slides.length; // set skinsLength value

    sliderPrev = function () {
        slider.prev();
    };

    sliderNext = function () {
        slider.next()
    };

    return slider;

}