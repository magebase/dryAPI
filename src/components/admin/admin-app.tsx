"use client"

import {
  Admin,
  Create,
  Datagrid,
  Edit,
  List,
  NumberInput,
  Resource,
  SimpleForm,
  TextField,
  TextInput,
  required,
} from "react-admin"
import simpleRestProvider from "ra-data-simple-rest"

const dataProvider = simpleRestProvider("/api/cms")

const SiteSettingsList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="companyName" />
      <TextField source="phone" />
      <TextField source="email" />
    </Datagrid>
  </List>
)

const SiteSettingsEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput disabled source="id" />
      <TextInput source="companyName" validate={[required()]} />
      <TextInput source="tagline" validate={[required()]} />
      <TextInput source="phone" validate={[required()]} />
      <TextInput source="email" validate={[required()]} />
      <TextInput multiline source="address" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const NavigationList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="label" />
      <TextField source="href" />
      <TextField source="order" />
    </Datagrid>
  </List>
)

const NavigationEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="label" validate={[required()]} />
      <TextInput source="href" validate={[required()]} />
      <NumberInput source="order" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const NavigationCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="label" validate={[required()]} />
      <TextInput source="href" validate={[required()]} />
      <NumberInput source="order" validate={[required()]} />
    </SimpleForm>
  </Create>
)

const HeroList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="heading" />
      <TextField source="primaryCtaLabel" />
    </Datagrid>
  </List>
)

const HeroEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput disabled source="id" />
      <TextInput source="eyebrow" validate={[required()]} />
      <TextInput multiline source="heading" validate={[required()]} />
      <TextInput multiline source="subheading" validate={[required()]} />
      <TextInput source="primaryCtaLabel" validate={[required()]} />
      <TextInput source="primaryCtaHref" validate={[required()]} />
      <TextInput source="secondaryCtaLabel" validate={[required()]} />
      <TextInput source="secondaryCtaHref" validate={[required()]} />
      <TextInput source="heroImage" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const ServicesList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="title" />
      <TextField source="icon" />
    </Datagrid>
  </List>
)

const ServicesEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="title" validate={[required()]} />
      <TextInput multiline source="description" validate={[required()]} />
      <TextInput source="icon" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const ServicesCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="title" validate={[required()]} />
      <TextInput multiline source="description" validate={[required()]} />
      <TextInput source="icon" validate={[required()]} />
    </SimpleForm>
  </Create>
)

const ProjectsList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="sector" />
    </Datagrid>
  </List>
)

const ProjectsEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="name" validate={[required()]} />
      <TextInput source="sector" validate={[required()]} />
      <TextInput multiline source="summary" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const ProjectsCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput source="name" validate={[required()]} />
      <TextInput source="sector" validate={[required()]} />
      <TextInput multiline source="summary" validate={[required()]} />
    </SimpleForm>
  </Create>
)

const TestimonialsList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="author" />
      <TextField source="role" />
    </Datagrid>
  </List>
)

const TestimonialsEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput multiline source="quote" validate={[required()]} />
      <TextInput source="author" validate={[required()]} />
      <TextInput source="role" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

const TestimonialsCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="id" validate={[required()]} />
      <TextInput multiline source="quote" validate={[required()]} />
      <TextInput source="author" validate={[required()]} />
      <TextInput source="role" validate={[required()]} />
    </SimpleForm>
  </Create>
)

const ContactList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="heading" />
      <TextField source="responseTime" />
    </Datagrid>
  </List>
)

const ContactEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput disabled source="id" />
      <TextInput source="heading" validate={[required()]} />
      <TextInput multiline source="description" validate={[required()]} />
      <TextInput source="responseTime" validate={[required()]} />
    </SimpleForm>
  </Edit>
)

export function AdminApp() {
  return (
    <Admin dataProvider={dataProvider} disableTelemetry title="Website CMS">
      <Resource name="siteSettings" edit={SiteSettingsEdit} list={SiteSettingsList} />
      <Resource create={NavigationCreate} edit={NavigationEdit} list={NavigationList} name="navigation" />
      <Resource edit={HeroEdit} list={HeroList} name="hero" />
      <Resource create={ServicesCreate} edit={ServicesEdit} list={ServicesList} name="services" />
      <Resource create={ProjectsCreate} edit={ProjectsEdit} list={ProjectsList} name="projects" />
      <Resource
        create={TestimonialsCreate}
        edit={TestimonialsEdit}
        list={TestimonialsList}
        name="testimonials"
      />
      <Resource edit={ContactEdit} list={ContactList} name="contact" />
    </Admin>
  )
}
