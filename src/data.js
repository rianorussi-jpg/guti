const img = name => `/assets/menu/${name}.jpg`
let id = 1
const item = (name, category, price, desc, image, extra={}) => ({ id:id++, name, category, price, desc, image:img(image), ...extra })

export const categories = [
  'Favoritos','Entradas','Kushiagues','Sopas','Ramen','Poke Bowl','Sushi Tower','Pizza Sushi',
  'Rollos clásicos','Rollos tempurizados','Rollos empanizados','Rollos especiales',
  'Sashimi','Temaki','Niguiri','Arroz','Cocina caliente','Postres','Bebidas'
]

export const products = [
  // ENTRADAS
  item('Edamames','Entradas',98,'150 g · Al vapor, asados con mantequilla y soya o spicy lemon.','edamames',{featured:true}),
  item('Tostadas de atún o salmón','Entradas',142,'4 piezas · Atún o salmón fresco, pepino, mango, cebollín, aguacate, mayo chipotle y toque cítrico.','tostadas',{featured:true}),
  item('Camarones Rokka','Entradas',168,'Trozos de camarón tempura bañados en mayo chipotle, cebollín y aguacate sobre cama de ensalada.','rokka',{featured:true,spicy:true}),
  item('Spring Rolls','Entradas',92,'4 piezas · Rellenos de vegetales, acompañados de salsa agridulce.','spring-rolls'),
  item('Gyozas de cerdo','Entradas',104,'5 piezas · Empanadillas fritas de cerdo con vegetales y salsa spicy ponzu.','gyozas'),
  item('Gyozas de camarón','Entradas',112,'5 piezas · Empanadillas fritas acompañadas de salsa spicy ponzu.','gyozas'),
  item('Tampico Poppers','Entradas',104,'3 piezas · Bolitas de arroz rellenas de aguacate y queso Filadelfia, empanizadas, con tampico y salsa de anguila.','tampico-poppers'),
  item('Chicken Karaague','Entradas',112,'Bocados crujientes de pechuga marinada en soya, ajo y jengibre, con mayo chipotle y limón.','karaague'),
  item('Tempura de verduras','Entradas',116,'4 piezas · Verduras de temporada tempurizadas.','tempura-verduras'),
  item('Tempura de verduras con camarón','Entradas',162,'4 piezas · Verduras de temporada y camarón tempurizado.','tempura-verduras'),

  // KUSHIAGUES
  item('Kushiague de queso manchego','Kushiagues',106,'2 piezas · Brochetas empanizadas acompañadas de salsa kushiague.','kushi-queso'),
  item('Kushiague de queso manchego · 3 piezas','Kushiagues',144,'3 piezas · Brochetas empanizadas acompañadas de salsa kushiague.','kushi-queso'),
  item('Kushiague de plátano con Filadelfia','Kushiagues',86,'2 piezas · Plátano con queso Filadelfia empanizado.','kushi-platano'),
  item('Kushiague de plátano con Filadelfia · 3 piezas','Kushiagues',128,'3 piezas · Plátano con queso Filadelfia empanizado.','kushi-platano'),
  item('Kushiague de salmón con Filadelfia','Kushiagues',112,'2 piezas · Salmón con queso Filadelfia empanizado.','kushi-salmon'),
  item('Kushiague de salmón con Filadelfia · 3 piezas','Kushiagues',154,'3 piezas · Salmón con queso Filadelfia empanizado.','kushi-salmon'),
  item('Kushiague de camarón con Filadelfia','Kushiagues',128,'2 piezas · Camarón con queso Filadelfia empanizado.','kushi-camaron'),
  item('Kushiague de camarón con Filadelfia · 3 piezas','Kushiagues',168,'3 piezas · Camarón con queso Filadelfia empanizado.','kushi-camaron'),
  item('Kushiague Mixta','Kushiagues',136,'3 piezas · Camarón con Filadelfia, queso manchego y plátano con Filadelfia.','kushi-mixta'),

  // SOPAS
  item('Miso Shiro','Sopas',78,'225 ml · Fondo miso, fideo harusame, alga wakame, cebollín y tofu.','misoshiro'),
  item('Torizosui','Sopas',98,'225 ml · Pollo, harusame, germen de soya, elote, zanahoria, cebollín y fondo de pollo.','torizosui'),
  item('Eby Miso','Sopas',112,'225 ml · Fondo miso, camarones asados, harusame, wakame, cebollín y tofu.','ebymiso'),
  item('Sake Miso','Sopas',112,'225 ml · Fondo miso, salmón asado, harusame, wakame, cebollín y tofu.','sakemiso'),

  // RAMEN
  item('Pork Belly Ramen','Ramen',206,'Pasta ramen, pork belly teriyaki, naruto, col blanca, cebollín, zanahoria, huevo, espinaca, nori y fondo tonkotsu.','pork-belly-ramen',{featured:true}),
  item('Tantan Ramen','Ramen',218,'Pasta ramen, carne de cerdo picante, chile tempura, huevo, espinaca, ajonjolí y fondo tonkotsu.','tantan-ramen',{spicy:true}),
  item('Dumpling Ramen','Ramen',206,'Pasta ramen, gyozas de cerdo con vegetales, huevo, cebollín, ajonjolí negro, chili oil y fondo tonkotsu.','dumpling-ramen',{featured:true}),
  item('Ebi Crispy Ramen','Ramen',236,'Pasta ramen, camarones crujientes, cebollín, huevo, jitomate deshidratado, chilli oil y fondo tonkotsu.','ebi-crispy-ramen',{spicy:true}),
  item('Tori Ramen','Ramen',196,'Pasta ramen, pollo asado en salsa de parmesano y tomate, huevo, cebolla morada, cebollín, naruto y fondo tonkotsu o de pollo.','tori-ramen'),
  item('Midori Ramen','Ramen',196,'Pasta ramen, elote amarillo, espinaca tempura, zanahoria, cilantro, champiñón, tofu asado, cebolla morada y fondo tonkotsu o miso.','midori-ramen'),
  item('Baby Back Ramen','Ramen',244,'Pasta ramen, baby back rib, aguacate, cebolla morada, cebollín, jitomate deshidratado y fondo tonkotsu.','baby-back-ramen',{featured:true}),

  // POKE BOWL
  item('Sunset','Poke Bowl',196,'320 g · Salmón fresco, atún, pescado blanco, aguacate, cebollín y mayo sriracha.','sunset'),
  item('Salmon Poke','Poke Bowl',192,'320 g · Láminas de salmón fresco, aguacate, cebollín y mayo sriracha.','salmon-poke',{featured:true}),
  item('Tuna Poke','Poke Bowl',192,'320 g · Láminas de atún fresco, aguacate, cebollín y mayo sriracha.','tuna-poke'),
  item('Fujiyama','Poke Bowl',186,'320 g · Cubos de atún spicy, mango, aguacate, cebollín, mayo chipotle y vinagre dulce.','fujiyama',{spicy:true}),
  item('Tokio Bacon','Poke Bowl',186,'320 g · Salmón, tocino ahumado, aguacate, queso fila, pepino, cebollín y mayo habanero.','tokio-bacon'),
  item('Samurai','Poke Bowl',182,'320 g · Camarones rokka, mango, col morada, aguacate, cebollín, mayo teriyaki y mayo chipotle.','samurai'),
  item('Chicken Teriyaki','Poke Bowl',172,'320 g · Pollo teriyaki, tampico, aguacate y ajonjolí.','chicken-teriyaki'),
  item('Mongolian Beef','Poke Bowl',176,'320 g · Carne de res rebosada, salsa teriyaki, elote, tofu, edamame y ajonjolí.','mongolian-beef'),

  // TOWERS / PIZZA
  item('Rocky Tower','Sushi Tower',194,'220 g · Camarón rokka, tampico, mango, aguacate, col morada, mayo chipotle y salsa de anguila.','rocky-tower'),
  item('Tuna Tower','Sushi Tower',194,'220 g · Atún spicy, tampico, aguacate, mayo chipotle, harusame frito, masago y salsa de anguila.','tuna-tower',{spicy:true}),
  item('Salmon Tower','Sushi Tower',194,'220 g · Salmón spicy, aguacate, tampico, furikake, harusame frito, salsa teriyaki y sriracha.','salmon-tower',{spicy:true}),
  item('Rocket','Pizza Sushi',168,'226 g · Base crujiente de arroz, tampico, camarón rokka, aguacate, pepino, mayo chipotle y salsa de anguila.','rocket'),

  // CLASICOS
  item('California Roll · Vegetariano','Rollos clásicos',98,'10 piezas · Ajonjolí por fuera; aguacate, pepino y queso por dentro.','california-roll'),
  item('California Roll · Cangrejo','Rollos clásicos',114,'10 piezas · Ajonjolí por fuera; cangrejo, aguacate, pepino y queso.','california-roll'),
  item('California Roll · Camarón','Rollos clásicos',114,'10 piezas · Ajonjolí por fuera; camarón, aguacate, pepino y queso.','california-roll'),
  item('California Roll · Atún','Rollos clásicos',114,'10 piezas · Ajonjolí por fuera; atún, aguacate, pepino y queso.','california-roll'),
  item('California Roll · Salmón','Rollos clásicos',114,'10 piezas · Ajonjolí por fuera; salmón, aguacate, pepino y queso.','california-roll'),
  item('California Roll · Salmón ahumado','Rollos clásicos',128,'10 piezas · Ajonjolí por fuera; salmón ahumado, aguacate, pepino y queso.','california-roll'),
  item('Avocado Roll · Vegetariano','Rollos clásicos',98,'10 piezas · Aguacate y ajonjolí por fuera; pepino y queso por dentro.','avocado-roll'),
  item('Avocado Roll · Cangrejo','Rollos clásicos',116,'10 piezas · Aguacate y ajonjolí por fuera; cangrejo, pepino y queso.','avocado-roll'),
  item('Avocado Roll · Camarón','Rollos clásicos',116,'10 piezas · Aguacate y ajonjolí por fuera; camarón, pepino y queso.','avocado-roll'),
  item('Avocado Roll · Atún','Rollos clásicos',116,'10 piezas · Aguacate y ajonjolí por fuera; atún, pepino y queso.','avocado-roll'),
  item('Avocado Roll · Salmón','Rollos clásicos',116,'10 piezas · Aguacate y ajonjolí por fuera; salmón, pepino y queso.','avocado-roll'),
  item('Avocado Roll · Salmón ahumado','Rollos clásicos',132,'10 piezas · Aguacate y ajonjolí por fuera; salmón ahumado, pepino y queso.','avocado-roll'),
  item('Filadelfia Roll · Vegetariano','Rollos clásicos',92,'10 piezas · Nori por fuera y queso Filadelfia por dentro.','filadelfia-roll'),
  item('Filadelfia Roll · Cangrejo','Rollos clásicos',98,'10 piezas · Nori por fuera; cangrejo y queso Filadelfia.','filadelfia-roll'),
  item('Filadelfia Roll · Camarón','Rollos clásicos',98,'10 piezas · Nori por fuera; camarón y queso Filadelfia.','filadelfia-roll'),
  item('Filadelfia Roll · Atún','Rollos clásicos',102,'10 piezas · Nori por fuera; atún y queso Filadelfia.','filadelfia-roll'),
  item('Filadelfia Roll · Salmón','Rollos clásicos',102,'10 piezas · Nori por fuera; salmón y queso Filadelfia.','filadelfia-roll'),
  item('Filadelfia Roll · Salmón ahumado','Rollos clásicos',112,'10 piezas · Nori por fuera; salmón ahumado y queso Filadelfia.','filadelfia-roll'),

  // TEMPURIZADOS
  item('Godzila Roll','Rollos tempurizados',176,'10 piezas · Tempurizado con cangrejo, sriracha y salsa de anguila; salmón fresco, aguacate, pepino y queso.','godzila-roll'),
  item('Zakura Maki','Rollos tempurizados',176,'10 piezas · Tempurizado con nori, pasta baby y mayo chipotle; aguacate, atún y salmón.','zakura-maki'),
  item('Spicy Tuna Roll','Rollos tempurizados',154,'10 piezas · Tempurizado con nori, salsa de anguila y cebollín; aguacate y atún spicy.','spicy-tuna-roll',{featured:true,spicy:true}),
  item('Spicy Salmon Roll','Rollos tempurizados',156,'10 piezas · Tempurizado con nori, salsa de anguila y cebollín; aguacate y salmón spicy.','spicy-salmon-roll',{spicy:true}),

  // EMPANIZADOS
  item('Vulcan Roll','Rollos empanizados',162,'10 piezas · Empanizado con mix de manchego, tocino y cebollín; pollo tempura y aguacate.','vulcan-roll'),
  item('Tampico Roll','Rollos empanizados',148,'10 piezas · Empanizado con tampico y salsa kushiague; aguacate y pepino.','tampico-roll'),
  item('Tiger Roll','Rollos empanizados',156,'10 piezas · Empanizado con tampico, salsa de anguila y cebollín; camarón empanizado y aguacate.','tiger-roll',{featured:true}),
  item('Philly Roll','Rollos empanizados',162,'10 piezas · Empanizado con salsa de anguila; salmón, pepino y queso.','philly-roll'),

  // ESPECIALES
  item('Malibu Roll','Rollos especiales',162,'10 piezas · Mango, harusame y sishimit; camarón empanizado, queso Filadelfia, aguacate y pepino.','malibu-roll'),
  item('Lovely Roll','Rollos especiales',174,'10 piezas · Atún, mayo chipotle y salsa de anguila; kani tempura, aguacate, tampico y pepino.','lovely-roll'),
  item('Tip Top Roll','Rollos especiales',174,'10 piezas · Aguacate, tampico, camarón rokka, chipotle y salsa de anguila; kanikama, pepino y queso Filadelfia.','tip-top-roll'),
  item('Rainbow Roll','Rollos especiales',168,'10 piezas · Atún, aguacate, ajonjolí y salsa yuzu mango; tampico, salmón y pepino.','rainbow-roll'),
  item('Naruto Roll','Rollos especiales',186,'10 piezas · Anguila, almendra, ajonjolí y salsa de anguila; aguacate, pepino y harusame frito.','naruto-roll'),
  item('Tuna Roll','Rollos especiales',162,'10 piezas · Atún, salsa mango, harusame frito, masago y cebollín; pescado tempura, aguacate y pepino.','tuna-roll'),
  item('Dragon Roll','Rollos especiales',162,'10 piezas · Mango, aguacate, nuez caramelizada y salsa de anguila; camarón empanizado, queso y aguacate.','dragon-roll'),
  item('Kong Roll','Rollos especiales',154,'10 piezas · Plátano frito, mayo chipotle y salsa de anguila; kani crujiente, queso y aguacate.','kong-roll'),
  item('Baby Roll','Rollos especiales',174,'10 piezas · Furikake de salmón, queso Filadelfia y salsa de anguila; camarón empanizado, tampico y aguacate.','baby-roll'),
  item('Osaka Roll','Rollos especiales',172,'10 piezas · Salmón, aguacate, sishimit y harusame frito; camarón empanizado, pasta baby y pepino.','osaka-roll'),
  item('Culichi Roll','Rollos especiales',164,'10 piezas · Queso manchego e hilo de papa frita; arrachera, camarón empanizado y aguacate.','culichi-roll'),
  item('Mar y Tierra','Rollos especiales',184,'10 piezas · Aguacate y mayo habanero; arrachera, pollo, camarón y queso.','mar-y-tierra'),
  item('Dinamita Roll','Rollos especiales',164,'10 piezas · Tartar de atún, tampico y cebollín; kanikama y aguacate.','dinamita-roll'),
  item('Crunch Roll','Rollos especiales',172,'10 piezas · Salmón fresco, mayo chipotle y cebollín; kakiage de verduras, queso crema y aguacate.','crunch-roll'),
  item('Yakuza Roll','Rollos especiales',172,'10 piezas · Arrachera, tocino y jalapeños gratinados con queso manchego; aguacate.','yakuza-roll'),
  item("Muncher's Roll",'Rollos especiales',184,'10 piezas · Nori, salmón, poppers de salmón con Filadelfia y cebollín; aguacate, salsa de anguila y chipotle.', 'munchers-roll'),
  item('Ninja Roll','Rollos especiales',154,'10 piezas · Hoja de pepino, tampico, camarón rokka y salsa de anguila; aguacate, pepino y queso Filadelfia.','ninja-roll'),

  // SASHIMI
  item('Sashimi de salmón fresco','Sashimi',198,'95 g · Finas láminas de pescado fresco, wasabi y gari.','sashimi'),
  item('Sashimi de atún','Sashimi',198,'95 g · Finas láminas de atún fresco, wasabi y gari.','sashimi'),
  item('Sashimi de pescado blanco','Sashimi',198,'95 g · Finas láminas de pescado blanco, wasabi y gari.','sashimi'),
  item('KYO Sashimi','Sashimi',212,'95 g · Selección estilo KYO, acompañada de wasabi y gari.','sashimi'),
  item('Tiradito atún / salmón','Sashimi',198,'95 g · Atún o salmón fresco en corte tipo tiradito.','sashimi'),

  // TEMAKI
  item('Temaki de atún','Temaki',84,'1 pieza · Nori, arroz shari, aguacate, pepino, queso Filadelfia y atún.','temaki'),
  item('Temaki de salmón','Temaki',84,'1 pieza · Nori, arroz shari, aguacate, pepino, queso Filadelfia y salmón.','temaki'),
  item('Temaki de camarón','Temaki',84,'1 pieza · Nori, arroz shari, aguacate, pepino, queso Filadelfia y camarón.','temaki'),
  item('Temaki de cangrejo','Temaki',84,'1 pieza · Nori, arroz shari, aguacate, pepino, queso Filadelfia y cangrejo.','temaki'),
  item('Temaki de anguila','Temaki',102,'1 pieza · Nori, arroz shari, aguacate, pepino, queso Filadelfia y anguila.','temaki'),

  // NIGUIRI
  item('Niguiri de atún','Niguiri',84,'1 pieza · Bocado de arroz cubierto con atún, salsa nikiri y mayo chipotle.','niguiri'),
  item('Niguiri de salmón','Niguiri',84,'1 pieza · Bocado de arroz cubierto con salmón, salsa nikiri y mayo chipotle.','niguiri'),
  item('Niguiri de camarón','Niguiri',84,'1 pieza · Bocado de arroz cubierto con camarón, salsa nikiri y mayo chipotle.','niguiri'),
  item('Niguiri de cangrejo','Niguiri',84,'1 pieza · Bocado de arroz cubierto con cangrejo, salsa nikiri y mayo chipotle.','niguiri'),
  item('Niguiri de anguila','Niguiri',102,'1 pieza · Bocado de arroz cubierto con anguila, salsa nikiri y mayo chipotle.','niguiri'),
  item('Niguiri Sampler','Niguiri',202,'4 piezas · Selección de niguiris. No aplica anguila.','niguiri'),

  // ARROZ
  item('Gohan al vapor con cebollín','Arroz',62,'260 g · Arroz blanco al vapor con cebollín.','gohan-kyo'),
  item('Gohan al vapor con tampico y cebollín','Arroz',86,'260 g · Arroz blanco al vapor con tampico y cebollín.','gohan-kyo'),
  item('Gohan con pollo','Arroz',88,'260 g · Arroz blanco con pollo.','gohan-kyo'),
  item('Yakimeshi de vegetales','Arroz',82,'320 g · Arroz frito con mix de vegetales, mantequilla y un toque de soya.','yakimeshi-mixto'),
  item('Yakimeshi con tampico','Arroz',94,'320 g · Arroz frito con tampico, mantequilla y un toque de soya.','yakimeshi-mixto'),
  item('Yakimeshi de pollo','Arroz',104,'320 g · Arroz frito con pollo, vegetales, mantequilla y un toque de soya.','yakimeshi-mixto'),
  item('Yakimeshi de camarón','Arroz',122,'320 g · Arroz frito con camarón, vegetales, mantequilla y un toque de soya.','yakimeshi-mixto'),
  item('Yakimeshi de pork belly teriyaki','Arroz',122,'320 g · Arroz frito con pork belly teriyaki, vegetales y soya.','yakimeshi-mixto'),
  item('Yakimeshi de arrachera','Arroz',124,'320 g · Arroz frito con arrachera, vegetales y soya.','yakimeshi-mixto'),
  item('Pulpo Ajo','Arroz',144,'320 g · Arroz yakimeshi con pulpo al ajo.','pulpo-ajo'),
  item('Yakimeshi Mixto','Arroz',134,'320 g · Arroz yakimeshi con pollo, camarón y arrachera.','yakimeshi-mixto',{featured:true}),
  item('Gohan KYO','Arroz',108,'320 g · Arroz gohan, tampico, aguacate, mango, kanikama tempura, mayo chipotle y salsa de anguila.','gohan-kyo',{featured:true}),

  // COCINA CALIENTE
  item('Teppanyaki de vegetales','Cocina caliente',178,'350 g · Al wok con mantequilla, ajonjolí, cebollín y un toque de soya.','teppanyaki'),
  item('Teppanyaki de pollo','Cocina caliente',222,'350 g · Pollo y vegetales al wok con mantequilla, ajonjolí, cebollín y soya.','teppanyaki'),
  item('Teppanyaki de camarón','Cocina caliente',238,'350 g · Camarón y vegetales al wok con mantequilla, ajonjolí, cebollín y soya.','teppanyaki'),
  item('Teppanyaki mixto','Cocina caliente',254,'350 g · Camarón, pollo, arrachera y vegetales al wok.','teppanyaki'),
  item('Teppanyaki de arrachera','Cocina caliente',242,'350 g · Arrachera y vegetales al wok con mantequilla, ajonjolí, cebollín y soya.','teppanyaki'),
  item('Yakisoba de vegetales','Cocina caliente',182,'350 g · Fideos, cebolla morada, zanahoria, brócoli, calabaza, champiñón y salsa teriyaki.','yakisoba'),
  item('Yakisoba de pollo','Cocina caliente',224,'350 g · Fideos y vegetales con pollo y salsa teriyaki.','yakisoba'),
  item('Yakisoba de camarón','Cocina caliente',242,'350 g · Fideos y vegetales con camarón y salsa teriyaki.','yakisoba'),
  item('Yakisoba de arrachera','Cocina caliente',246,'350 g · Fideos y vegetales con arrachera y salsa teriyaki.','yakisoba'),
  item('Yakisoba mixto','Cocina caliente',256,'350 g · Fideos y vegetales con combinación de proteínas y salsa teriyaki.','yakisoba'),
  item('Chicken Fry Roll','Cocina caliente',204,'250 g · Rollo de pechuga rellena con vegetales y queso manchego, con arroz gohan y ensalada.','chicken-fry-roll'),
  item('Teriyaki de salmón','Cocina caliente',268,'280 g · Lomo de salmón a la plancha glaseado con teriyaki, acompañado de arroz gohan y ensalada.','teriyaki-salmon'),

  // POSTRES
  item('Banana Fry','Postres',88,'160 g · Kushiagues de plátano con helado de vainilla y salsa de chocolate.','banana-fry'),
  item('Camelado','Postres',82,'120 ml · Gelatina de café con crema de Kahlua y helado de vainilla.','camelado'),
  item('Flan de Matcha','Postres',84,'1 pieza · Flan cremoso sabor matcha.','flan-matcha'),
  item('Helado Tempura','Postres',98,'160 g · Helado de vainilla tempurizado con fresa y salsa de chocolate o cajeta.','helado-tempura'),
  item('Cheese Cake Japonés','Postres',126,'Individual · Acompañado de helado de vainilla y salsa de frutos rojos.','cheesecake-japones',{featured:true}),

  // BEBIDAS
  item('Agua Ciel 600 ml','Bebidas',38,'Agua natural Ciel 600 ml.','bebidas'),
  item('Agua Ciel mineral 355 ml','Bebidas',45,'Agua mineral Ciel 355 ml.','bebidas'),
  item('Refrescos','Bebidas',45,'Consulta disponibilidad de sabores.','bebidas'),
  item('Calpis natural 400 ml','Bebidas',56,'Bebida japonesa Calpis natural.','bebidas'),
  item('Calpis mineral 400 ml','Bebidas',62,'Calpis mineral 400 ml.','bebidas'),
  item('Calpis de sabores 400 ml','Bebidas',72,'Consulta sabores disponibles.','bebidas'),
  item('Soda italiana','Bebidas',70,'Consulta sabores disponibles.','bebidas'),
  item('Limonada mineral o natural 400 ml','Bebidas',54,'Elige natural o mineral.','bebidas'),
  item('Naranjada mineral o natural 400 ml','Bebidas',54,'Elige natural o mineral.','bebidas'),
  item('Agua de temporada 400 ml','Bebidas',42,'Consulta el sabor de temporada.','bebidas'),
  item('Té Verde Sencha 400 ml','Bebidas',48,'Té verde Sencha.','bebidas'),
  item('Té Matcha 400 ml','Bebidas',64,'Té matcha 400 ml.','bebidas'),
  item('Ramune 200 ml','Bebidas',87,'Varios sabores.','bebidas'),
  item('Servicio de té 400 ml','Bebidas',48,'Servicio de té de 400 ml.','bebidas')
]

export const branches = [
  { id:'zakia', name:'KYO Zákia', short:'Zákia', address:'Plaza UNITY, local 103 PB, Zákia, Querétaro', phone:'442 890 3797', eta:'30–40 min', schedule:'Consulta horario' },
  { id:'milenio', name:'KYO Milenio', short:'Milenio III', address:'Plaza UBIKA Milenio, local 112, Milenio III, Querétaro', phone:'442 283 4928', eta:'25–35 min', schedule:'Consulta horario' }
]
