-- One-off import of the client + responsables directory the user compiled
-- in Excel ("BASE DE DATOS APP A23 DE NOV 2026.xlsx", sheet "Responsables",
-- 76 rows) as the authoritative source for client_contacts, re-linking each
-- row to its matching real project (by code + client) so existing projects
-- get their responsables back without retyping them one by one.
--
-- Must run after 20261124150000_client_contacts.sql. Safe to run only once
-- per environment -- rerunning just refreshes phone/cargo on existing
-- fichas and skips project links that already exist.

create temporary table excel_import_data (
  empresa text not null,
  codigo text not null,
  role_label text not null,
  nombre text not null,
  correo text,
  telefono text,
  cargo text
);

insert into excel_import_data (empresa, codigo, role_label, nombre, correo, telefono, cargo) values
  ('Acciona', '24-044', 'General', 'Jesús Espinosa', 'jesus.espinosa@mossia.net', '+4746544459', 'Responsable económico'),
  ('Acciona', '24-044', 'Técnico 1', 'Xavier Acuña', 'xavier.acuna@mossia.net', null, 'Técnico'),
  ('Acciona', '24-044', 'Técnico 2', 'Juan Gonzalez', 'juan.gonzalez@mossia.net', '+4797337350', 'Técnico'),
  ('Acciona', '25-045-ITA', 'General', 'Oscar Serrano Iruela', 'oscar.serrano.iruela@acciona.com', null, 'Responsable técnico'),
  ('Acciona', '25-045-ITA', 'Económico', 'María Morillo Leal', 'maria.morillo.leal@acciona.com', '+34690267333', 'Responsable economico'),
  ('Acciona', '25-050-ESP', 'General', 'Alfonso Henriquez De Luna Basagoiti', 'alfonso.henriquez.luna@acciona.com', '+34699468020', 'Project technical manager'),
  ('Acciona', '25-050-ESP', 'Económico', 'Elena Sáez Béjar', 'mariaelena.saez.bejar@acciona.com', '+34600466063', 'Departamento de Administración'),
  ('Acciona', '26-004-ESP', 'General', 'Maria Jesús Jiménez Tabasco', 'mariajesus.jimenez.tabasco@acciona.com', '+34672050917', 'Gestora'),
  ('Acciona', '26-004-ESP', 'Técnico 1', 'Oscar Serrano Iruela', 'oscar.serrano.iruela@acciona.com', null, 'Responsable técnico'),
  ('Acciona', '26-008-ESP', 'General', 'Alfonso Henriquez De Luna Basagoiti', 'alfonso.henriquez.luna@acciona.com', '+34699468020', 'Project technical manager'),
  ('Acciona', '26-008-ESP', 'Técnico 1', 'Pedro Pablo Sanz Ortega', 'pedropablo.sanz.ortega@acciona.com', '+34683662033', 'Estudios y Contratación Edificación'),
  ('Acciona', '26-008-ESP', 'Económico', 'Elena Sáez Béjar', 'mariaelena.saez.bejar@acciona.com', '+34600466063', 'Departamento de Administración'),
  ('Acciona', '26-010-ESP', 'General', 'Alfonso Henriquez De Luna Basagoiti', 'alfonso.henriquez.luna@acciona.com', '+34699468020', 'Project technical manager'),
  ('Acciona', '26-010-ESP', 'Económico', 'Elena Sáez Béjar', 'mariaelena.saez.bejar@acciona.com', '+34600466063', 'Departamento de Administración'),
  ('AECOM', '26-031-QAT', 'General', 'Syed Nadeem Ul Hassan', 'nadeem.hassan@aecom.com', '+97433974881', 'Director – Infrastructure Utilities'),
  ('CHB Team', '26-018', 'General', 'Pedro Gómez', 'pedrpjgomez@chbteam.com.au', '+61438589766', 'Construction Phase Services-CPS Manager'),
  ('CHB Team', '26-018', 'Técnico 1', 'Tristan Buchanan', 'tbuchanan@chbteam.com.au', '+61490446067', 'Design Coordinator'),
  ('Cumming Group', '26-034-FRA', 'General', 'Rayan Chokr', 'rayan.chokr@cumming-group.com', '+33670804473', 'Project Manager'),
  ('Cumming Group', '26-034-FRA', 'Técnico 1', 'Luc Maréchal', 'lucmarechal@atlm.net', '+33663739612', 'Architecte DPLG'),
  ('Cumming Group', '26-034-FRA', 'Económico', 'Jean-Paul Frédéric Rompillon Santana', 'jprompillon@louvre-hotels.com', '+34659481383', 'Directeur Design et Technique/Louvre Hotels Group'),
  ('Cumming Group', '26-044-FRA', 'General', 'Simon Reid', 'simon.reid@cumming-group.com', '+33609160101', 'Project Manager'),
  ('Cumming Group', '26-044-FRA', 'Técnico 1', 'Fabrice Knoll', 'fabrice.knoll@aol.fr', '+33608931402', 'KNOLL ARCHITECTURES, gabinete de arquitectura'),
  ('Cumming Group', '26-044-FRA', 'Económico', 'Jean-Paul Frédéric Rompillon Santana', 'jprompillon@louvre-hotels.com', '+34659481383', 'Directeur Design et Technique/Louvre Hotels Group'),
  ('Dragados', '25-053-ESP', 'General', 'Susana Mayorga Iglesias', 'smayorgai@dragados.com', '+34933105150', 'Dirección de Estudios — Centro Servicios Compartidos Noreste'),
  ('Dragados', '25-053-ESP', 'Técnico 1', 'Jordi Alegre Beneria', 'jalegreb@dragados.com', '+34629693607', 'Dirección de Estudios'),
  ('Dragados', '25-053-ESP', 'Económico', 'Mario Bodoque Atienza', 'mbodoquea@dragados.com', null, null),
  ('Dragados', '26-038-ESP', 'General', 'Jordi Alegre Beneria', 'jalegreb@dragados.com', '+34629693607', 'Dirección de Estudios'),
  ('Dragados', '26-038-ESP', 'Técnico 1', 'Susana Mayorga Iglesias', 'smayorgai@dragados.com', '+34933105150', 'Dirección de Estudios — Centro Servicios Compartidos Noreste'),
  ('Dragados', '26-048-ESP', 'General', 'Jordi Alegre Beneria', 'jalegreb@dragados.com', '+34629693607', 'Dirección de Estudios'),
  ('Dragados', '26-048-ESP', 'Técnico 1', 'Axel Caro', 'acarol@dragados.com', '+34676620781', 'Responsable técnico'),
  ('Dragados', '26-048-ESP', 'Técnico 2', 'Susana Mayorga Iglesias', 'smayorgai@dragados.com', '+34933105150', 'Dirección de Estudios — Centro Servicios Compartidos Noreste'),
  ('FCC', '23-034', 'General', 'David Castellanos Hidalgo', 'david.castellanos@fccco.com', '+31641820229', 'Design & Technical Office Manager'),
  ('FCC', '25-015', 'General', 'Gabriel Marchi da Silva', 'gabriel.marchi@fccco.com', '+31624862598', 'BIM Coordinator'),
  ('FCC', '25-015', 'Técnico 1', 'Maid Sivac', 'maid.sivac@fccco.com', null, 'Técnico BIM'),
  ('FCC', '25-015', 'Económico', 'Borrell Arque Eduardo', 'eduardo.borrell.arque@fcc.es', '+34670779385', 'Responsable facturación'),
  ('FCC', '25-052', 'General', 'Roberto Sanchez de Pablo Muela', 'rsanchezpablo@fcc.es', null, null),
  ('FCC', '25-052', 'Económico', 'José Luis Mendoza', 'jlmendoza@fcc.es', null, 'Responsable facturación'),
  ('FCC', '25-054', 'General', 'Alicia Gomez Gomez', 'alicia.gomez2@fccco.com', '+31624629381', 'Technical Supervision Department'),
  ('FCC', '25-054', 'Técnico 1', 'Raul Garcia Alonso', 'raul.garcia2@fccco.com', null, 'Jefe de obra; Manager Middle Section'),
  ('FCC', '25-054', 'Económico', 'David Castellanos Hidalgo', 'david.castellanos@fccco.com', '+31641820229', 'Design & Technical Office Manager'),
  ('FCC', '26-014-ALE', 'General', 'María José Sanz', 'mariajose.sanz@fccco.com', '+34609780233', 'Technical Office Manager'),
  ('FCC', '26-014-ALE', 'Económico', 'Paz Bartolomé Guijarro', 'mpbartolomeg@fcc.es', '+34917573329', null),
  ('Ferrovial', '25-052-ESP', 'General', 'Juan Carlos Villanueva Pastor', 'jcvillanuevapastor@ferrovial.com', '+34619457444', 'BIM Coordinator'),
  ('Ferrovial', '25-052-ESP', 'Técnico 1', 'Adrián Pardo Feijoo', 'apardo@ferrovial.com', '+34629763057', 'Head of Digital Construction – Data Centers'),
  ('Ferrovial', '26-032-ESP', 'General', 'Paula Herranz Martín-Caro', 'p.herranz@ferrovial.com', '+34689067399', 'Oficina Técnica'),
  ('Ferrovial', '26-035-ESP', 'General', 'Paula Herranz Martín-Caro', 'p.herranz@ferrovial.com', '+34689067399', 'Oficina Técnica'),
  ('Ferrovial', '26-046', 'General', 'Adrián Pardo Feijoo', 'apardo@ferrovial.com', '+34629763057', 'Head of Digital Construction – Data Centers'),
  ('Ferrovial', '26-046', 'Técnico 1', 'Jorge Manzano Rivero', 'jmanzanorivero@ferrovial.com', '+34690112627', 'Architect'),
  ('Ferrovial', '26-046', 'Técnico 2', 'Laura Pérez Aranda', 'lperezaranda@ferrovial.com', '+34686752297', 'Subdirección Edificación Madrid'),
  ('GEOCAMINOS SL', '26-026-ESP', 'General', 'Fran Quesada', 'fquesada@geocaminos.es', null, 'Responsable'),
  ('GEOCAMINOS SL', '26-026-ESP', 'Técnico 1', 'Anda Georgiana Alexandru', 'ageorgiana@geocaminos.es', '+34681364539', 'Técnico'),
  ('GEOCAMINOS SL', '26-026-ESP', 'Económico', 'Yolanda Sanz', 'administracion2@geocaminos.es', null, 'Administrativa'),
  ('Grupo Rover', '26-022-ESP', 'General', 'Alfredo Fernández–Villaverde Gonzalez', 'afvillaverde@btpinfraestructuras.es', '+34914875716', 'Jefe de Proyectos de Edificación / Architecture Project Manager'),
  ('IDOM', '26-050', 'General', 'Miguel Nogales Martinez', 'miguel.nogales@idom.com', '+34680270754', 'Civil Works Designer (Industry & Energy Department)'),
  ('IDOM', '26-050', 'Técnico 1', 'Francisco José Martinez Vermal', 'francisco.martinez@idom.com', null, 'Responsable BIM'),
  ('NGE', '26-047', 'Técnico 1', 'Chouaib EDDOUBI', 'ceddoubi@guintoli.fr', null, 'Cost Estimation Engineer'),
  ('OTG (ONTARIO TRANSIT GROUP)', '25-051-CAN', 'General', 'Esteban Litvin Di Santo', 'elitvin@ontransitgroup.ca', null, 'Technical Director'),
  ('OTG (ONTARIO TRANSIT GROUP)', '25-051-CAN', 'Técnico 1', 'Carlos Javier Jiménez González', 'cjjimenez@ontransitgroup.ca', '+14378295276', 'Design Manager'),
  ('OTG (ONTARIO TRANSIT GROUP)', '25-051-CAN', 'Económico', 'Eric Dallaire', 'jmarin@ontransitgroup.ca', null, null),
  ('Sacyr', '26-009-ESP', 'General', 'Eva Casas del Hoyo', 'ecasas@sacyr.com', '+34618662839', 'Gestor de Ofertas Edificación Business Development Department'),
  ('Sacyr', '26-036', 'General', 'Miguel Angel Diaz de Yela Melero', 'mdiazdeyela@sacyr.com', '+34650642379', 'Jefe de Obra/ Edificación'),
  ('Sacyr', '26-036', 'Técnico 1', 'Cristina Sarasola Martin', 'csarasola@empty.es', '+34682246928', 'Responsable Técnico'),
  ('Sacyr', '26-036', 'Técnico 2', 'Miguel Chica Ramos', 'mchica@sacyr.com', '+34606360152', 'Responsable de Construcción Digital y BIM'),
  ('Sacyr', '26-036', 'Técnico 3', 'Rubén Alonso Alonso', 'raalonso@sacyr.com', '+34649473916', 'Ingeniero de Estructuras / Area Ingenieria / Departamento Edificación'),
  ('Sacyr', '26-036', 'Económico', 'David Ibarra Garcia', 'dibarra@sacyr.com', null, 'Responsable de Facturación'),
  ('SR400 Constructors', '26-007', 'General', 'Jesus Gonzalez', 'jgonzalez@sr400cjv.com', null, 'Responsable general'),
  ('SR400 Constructors', '26-007', 'Técnico 1', 'Sofia Velasco', 'svelasco@sr400cjv.com', null, 'Responsable mediciones'),
  ('SR400 Constructors', '26-007', 'Técnico 2', 'Diego Blazquez', 'dblazquez@sr400cjv.com', null, 'Responsable Tierras'),
  ('TRILLIUM GIDEWAY PARTNERS', '24-027-CAN', 'General', 'Alejandro de Jong', 'alejandro.dejong@tgp.build', null, 'Engineering Manager'),
  ('TRILLIUM GIDEWAY PARTNERS', '24-027-CAN', 'Técnico 1', 'Daniela Morales', 'daniela.morales@tgp.build', null, 'Responsable Técnico'),
  ('TRILLIUM RAIL PARTNERT', '26-012-CAN', 'General', 'Juan Medina Puente', 'juan.medina@trp.build', '+14377172856', 'Project Director – ECWE SRS'),
  ('TRILLIUM RAIL PARTNERT', '26-012-CAN', 'Técnico 1', 'Jose Ignacio Montes Herraiz', 'jose.montes@trp.build', '+14377577280', 'Digital & BIM Delivery Director – ECWE SRS'),
  ('TRILLIUM RAIL PARTNERT', '26-012-CAN', 'Técnico 2', 'Colin Penlerick', 'colin.penlerick@trp.build', null, 'BoQ and Structure'),
  ('TRILLIUM RAIL PARTNERT', '26-012-CAN', 'Técnico 3', 'Naveed Ahamed Rawoof', 'naveed.rawoof@trp.build', '+19059793691', 'Procurement Manager'),
  ('TRILLIUM RAIL PARTNERT', '26-025-CAN', 'General', 'Juan Medina Puente', 'juan.medina@trp.build', '+14377172856', 'Project Director – ECWE SRS'),
  ('TRILLIUM RAIL PARTNERT', '26-025-CAN', 'Técnico 1', 'Jose Ignacio Montes Herraiz', 'jose.montes@trp.build', '+14377577280', 'Digital & BIM Delivery Director – ECWE SRS');

-- Step 1: ensure every distinct EMPRESA exists in clients (case-insensitive
-- match, same as findOrCreateClientId in the app).
insert into public.clients (name)
select distinct trim(e.empresa)
from excel_import_data e
where not exists (
  select 1 from public.clients c where lower(c.name) = lower(trim(e.empresa))
);

-- Step 2: insert/refresh each person's shared ficha. The Excel is the
-- "official" source, so re-running this after a correction updates
-- phone/cargo/name on an already-existing ficha instead of erroring.
insert into public.client_contacts (client_id, name, email, phone, description)
select distinct on (c.id, lower(trim(e.correo)))
  c.id,
  trim(e.nombre),
  trim(e.correo),
  nullif(trim(e.telefono), ''),
  nullif(trim(e.cargo), '')
from excel_import_data e
join public.clients c on lower(c.name) = lower(trim(e.empresa))
order by c.id, lower(trim(e.correo)), e.nombre
on conflict (client_id, lower(email)) where email is not null and trim(email) <> '' do update
  set name = excluded.name,
      phone = coalesce(excluded.phone, client_contacts.phone),
      description = coalesce(excluded.description, client_contacts.description);

-- Step 3: link each responsable to their real project, matched by code AND
-- client (skips a pairing that's already there, e.g. from a prior run or
-- from the generic backfill in the previous migration).
insert into public.project_contacts (project_id, client_contact_id, role_label)
select p.id, cc.id, e.role_label
from excel_import_data e
join public.clients c on lower(c.name) = lower(trim(e.empresa))
join public.projects p on p.code = trim(e.codigo) and p.client_id = c.id
join public.client_contacts cc on cc.client_id = c.id and lower(cc.email) = lower(trim(e.correo))
where not exists (
  select 1 from public.project_contacts pc2
  where pc2.project_id = p.id and pc2.client_contact_id = cc.id
);

-- Diagnostic: Excel rows whose código de proyecto didn't match any existing
-- project for that client -- review these by hand (e.g. still a proposal,
-- or a code typo'd differently in the app). Shown in the Results pane.
select distinct e.empresa, e.codigo
from excel_import_data e
join public.clients c on lower(c.name) = lower(trim(e.empresa))
left join public.projects p on p.code = trim(e.codigo) and p.client_id = c.id
where p.id is null
order by 1, 2;

drop table excel_import_data;
